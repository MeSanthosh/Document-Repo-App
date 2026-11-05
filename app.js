/* Project Document Register — static site for GitHub Pages, data in Supabase (free tier). */
"use strict";

const DEFAULT_FOLDERS = ["Requirements", "Design", "Development", "Testing", "Release", "Meetings"];
const BUCKET = "documents";
const MAX_BYTES = 50 * 1024 * 1024; // Supabase free tier per-file limit
const TEXT_EXT = ["txt", "md", "csv", "json", "log", "xml", "yml", "yaml", "sql"];

const CFG = window.APP_CONFIG || {};
const $ = (id) => document.getElementById(id);
const S = { sb: null, session: null, projects: [], docs: [], current: null, folder: "All", query: "" };

/* ---------- small helpers ---------- */
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
};
const abbr = (f) => f.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "DOC";
const ext = (name) => ((name || "").split(".").pop() || "").toLowerCase();
const fmtSize = (b) => !b ? "—" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch { return ""; } };
let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
function notice(msg) { $("notice").textContent = msg || ""; $("notice").hidden = !msg; }
function errText(e) {
  if (!e) return "Something went wrong. Try again.";
  if (e.code === "23505") return "That number or code is already used. Try again.";
  if (e.code === "23503") return "Remove this project's documents before deleting it.";
  if (e.code === "42501" || /row-level security/i.test(e.message || "")) return "You don't have permission to do that. Sign in again.";
  return e.message || "Something went wrong. Try again.";
}

/* ---------- boot + sign-in ---------- */
(async function boot() {
  if (CFG.COMPANY_NAME) { document.title = CFG.COMPANY_NAME; $("brandTitle").textContent = CFG.COMPANY_NAME; $("loginTitle").textContent = CFG.COMPANY_NAME; }
  if (!window.supabase || !CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes("YOUR-PROJECT")) { $("setup").hidden = false; return; }
  S.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const { data } = await S.sb.auth.getSession();
  setSession(data.session);
  S.sb.auth.onAuthStateChange((_evt, session) => setSession(session));
})();

function setSession(session) {
  const was = S.session && S.session.user.id;
  S.session = session;
  $("login").hidden = !!session;
  $("app").hidden = !session;
  if (session) {
    $("meEmail").textContent = session.user.email || "";
    if (was !== session.user.id) load();
  }
}

$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("loginErr"); err.hidden = true;
  $("loginBtn").disabled = true;
  const { error } = await S.sb.auth.signInWithPassword({ email: $("li-email").value.trim(), password: $("li-pass").value });
  $("loginBtn").disabled = false;
  if (error) { err.textContent = /invalid/i.test(error.message) ? "That email and password don't match. Check them and try again." : error.message; err.hidden = false; }
});
$("signOutBtn").addEventListener("click", () => S.sb.auth.signOut());
$("refreshBtn").addEventListener("click", () => load().then(() => toast("Up to date")));
$("newProjectBtn").addEventListener("click", () => openProjectForm());
$("welcomeBtn").addEventListener("click", () => openProjectForm());
const WELCOME = $("welcome");

/* ---------- data ---------- */
async function load() {
  const [p, d] = await Promise.all([
    S.sb.from("projects").select("*").order("name"),
    S.sb.from("documents").select("*").order("added_at", { ascending: false }),
  ]);
  if (p.error || d.error) { notice("Couldn't load the register: " + errText(p.error || d.error)); return; }
  notice("");
  S.projects = p.data; S.docs = d.data;
  if (S.current && !S.projects.find((x) => x.id === S.current)) S.current = null;
  if (!S.current && S.projects.length) S.current = S.projects[0].id;
  render();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.session) load(); });

/* ---------- render ---------- */
function render() {
  const plist = $("plist"); plist.replaceChildren();
  $("sideEmpty").hidden = S.projects.length > 0;
  for (const p of S.projects) {
    const n = S.docs.filter((d) => d.project_id === p.id).length;
    plist.append(el("li", {}, el("button", { type: "button", "aria-current": p.id === S.current ? "true" : "false", onclick: () => { S.current = p.id; S.folder = "All"; render(); } },
      el("span", { class: "pc", text: p.code }), el("span", { class: "pname", text: p.name }), el("span", { class: "pn", text: String(n) }))));
  }

  const main = $("main");
  const p = S.projects.find((x) => x.id === S.current);
  if (!p) { main.replaceChildren(WELCOME); return; }

  const folders = p.folders && p.folders.length ? p.folders : DEFAULT_FOLDERS;
  const pdocs = S.docs.filter((d) => d.project_id === p.id);
  if (S.folder !== "All" && !folders.includes(S.folder)) S.folder = "All";
  const q = S.query.trim().toLowerCase();
  let rows = pdocs.filter((d) => S.folder === "All" || d.folder === S.folder);
  if (q) rows = rows.filter((d) => [d.title, d.code, d.note, d.file_name, d.folder, d.added_by_email].join(" ").toLowerCase().includes(q));

  const head = el("div", { class: "phead" },
    el("div", {}, el("div", { class: "code", text: p.code }), el("h2", { text: p.name }), p.description ? el("p", { text: p.description }) : null),
    el("div", { class: "actions" },
      el("button", { class: "btn", type: "button", onclick: () => openProjectForm(p) }, "Edit project"),
      el("button", { class: "btn primary", type: "button", onclick: () => openDocForm(p, folders) }, "Add document")));

  const tabs = el("div", { class: "tabs", role: "tablist" },
    [["All", pdocs.length], ...folders.map((f) => [f, pdocs.filter((d) => d.folder === f).length])].map(([f, n]) =>
      el("button", { type: "button", role: "tab", "aria-selected": S.folder === f ? "true" : "false", onclick: () => { S.folder = f; render(); } }, f, el("span", { class: "n", text: String(n) }))),
    el("button", { type: "button", class: "add", onclick: () => openFolderForm(p, folders) }, "+ Folder"));

  const search = el("input", { class: "search", id: "search", type: "search", placeholder: "Filter by title, number, note or person", value: S.query, "aria-label": "Filter documents" });
  search.addEventListener("input", () => { S.query = search.value; render(); const s = $("search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); });
  const toolbar = el("div", { class: "toolbar" }, search, el("span", { class: "status", text: rows.length + (rows.length === 1 ? " document" : " documents") }));

  let body;
  if (!pdocs.length) {
    body = el("div", { class: "empty" }, el("h3", { text: "No documents in " + p.name + " yet" }),
      el("p", { text: "Upload any file (PDF, Word, Excel, images…) up to 50 MB, or add a link to a document kept elsewhere." }),
      el("button", { class: "btn primary", type: "button", onclick: () => openDocForm(p, folders) }, "Add the first document"));
  } else if (!rows.length) {
    body = el("div", { class: "empty" }, el("p", { text: q ? "Nothing matches “" + S.query + "”." : "This folder is empty." }));
  } else {
    const tbody = el("tbody");
    for (const d of rows) {
      tbody.append(el("tr", {},
        el("td", { class: "code", text: d.code }),
        el("td", {},
          d.kind === "file" ? el("button", { type: "button", class: "dtitle linkish", onclick: () => openViewer(d), text: d.title })
            : el("a", { class: "dtitle", href: d.url, target: "_blank", rel: "noopener noreferrer", text: d.title }),
          el("div", { class: "dnote", text: [d.file_name, d.note].filter(Boolean).join(" · ") })),
        el("td", {}, el("span", { class: "kind" + (d.kind === "link" ? " link" : ""), text: d.kind === "link" ? "Link" : ext(d.file_name) || "file" })),
        el("td", { class: "num", text: S.folder === "All" ? d.folder : fmtSize(d.size_bytes) }),
        el("td", { text: d.added_by_email || "—" }),
        el("td", { class: "num", text: fmtDate(d.added_at) }),
        el("td", {}, el("div", { class: "row-actions" }, el("button", { class: "btn small danger", type: "button", onclick: () => confirmDeleteDoc(d) }, "Remove")))));
    }
    body = el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, ["No.", "Title", "Type", S.folder === "All" ? "Folder" : "Size", "Added by", "Date", ""].map((h) => el("th", { text: h })))), tbody));
  }
  main.replaceChildren(head, tabs, toolbar, body);
}

/* ---------- modal ---------- */
function openModal(wide, ...kids) {
  $("modal").classList.toggle("wide", !!wide);
  $("modal").replaceChildren(...kids); $("overlay").hidden = false;
  const f = $("modal").querySelector("input,select,textarea"); if (f) f.focus();
}
function closeModal() { $("overlay").hidden = true; $("modal").replaceChildren(); }
$("overlay").addEventListener("click", (e) => { if (e.target === $("overlay")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("overlay").hidden) closeModal(); });
const field = (label, input, hint) => el("div", { class: "field" }, el("label", { for: input.id, text: label }), input, hint ? el("div", { class: "hint", text: hint }) : null);

/* ---------- projects ---------- */
function openProjectForm(p) {
  const name = el("input", { id: "pf-name", maxlength: "80", value: p ? p.name : "", placeholder: "CRM Application" });
  const code = el("input", { id: "pf-code", maxlength: "6", value: p ? p.code : "", placeholder: "CRM", style: "text-transform:uppercase;font-family:var(--f-mono)" });
  const desc = el("textarea", { id: "pf-desc", rows: "3", maxlength: "400", placeholder: "Client, scope, or anything that helps people find it" }); desc.value = p ? p.description || "" : "";
  const err = el("div", { class: "err", hidden: true });
  name.addEventListener("input", () => { if (!p && !code.dataset.touched) code.value = name.value.split(/\s+/).map((w) => w[0] || "").join("").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase(); });
  code.addEventListener("input", () => (code.dataset.touched = "1"));
  const save = el("button", { class: "btn primary", type: "submit" }, p ? "Save changes" : "Create project");
  const canDelete = p && !S.docs.some((d) => d.project_id === p.id);
  const form = el("form", {},
    el("h3", { text: p ? "Edit project" : "New project" }),
    field("Project name", name), field("Project code", code, "2–6 letters or digits, used in document numbers such as CRM-REQ-001. Changing it doesn't renumber existing documents."),
    field("Description", desc), err,
    el("div", { class: "modal-foot" },
      canDelete ? el("button", { class: "btn danger", type: "button", onclick: () => deleteProject(p) }, "Delete project") : null,
      el("button", { class: "btn", type: "button", onclick: closeModal }, "Cancel"), save));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = code.value.trim().toUpperCase();
    const fail = (m) => { err.textContent = m; err.hidden = false; save.disabled = false; };
    if (!name.value.trim()) return fail("Give the project a name.");
    if (!/^[A-Z0-9]{2,6}$/.test(c)) return fail("Use 2–6 letters or digits for the code.");
    save.disabled = true;
    const row = { name: name.value.trim(), code: c, description: desc.value.trim() };
    const res = p ? await S.sb.from("projects").update(row).eq("id", p.id).select().single()
                  : await S.sb.from("projects").insert({ ...row, folders: DEFAULT_FOLDERS }).select().single();
    if (res.error) return fail(res.error.code === "23505" ? "Another project already uses " + c + "." : errText(res.error));
    if (!p) { S.current = res.data.id; S.folder = "All"; }
    closeModal(); toast(p ? "Project saved" : "Project created"); load();
  });
  openModal(false, form);
}
async function deleteProject(p) {
  const { error } = await S.sb.from("projects").delete().eq("id", p.id);
  if (error) return toast(errText(error));
  S.current = null; closeModal(); toast("Project deleted"); load();
}
function openFolderForm(p, folders) {
  const name = el("input", { id: "ff-name", maxlength: "30", placeholder: "Contracts" });
  const err = el("div", { class: "err", hidden: true });
  const form = el("form", {}, el("h3", { text: "Add a folder to " + p.name }), field("Folder name", name), err,
    el("div", { class: "modal-foot" }, el("button", { class: "btn", type: "button", onclick: closeModal }, "Cancel"), el("button", { class: "btn primary", type: "submit" }, "Add folder")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = name.value.trim();
    if (!n) { err.textContent = "Type a folder name."; err.hidden = false; return; }
    if (folders.some((f) => f.toLowerCase() === n.toLowerCase())) { err.textContent = "That folder already exists."; err.hidden = false; return; }
    const { error } = await S.sb.from("projects").update({ folders: [...folders, n] }).eq("id", p.id);
    if (error) { err.textContent = errText(error); err.hidden = false; return; }
    S.folder = n; closeModal(); toast("Folder added"); load();
  });
  openModal(false, form);
}

/* ---------- documents ---------- */
async function nextCode(p, folder) {
  const prefix = p.code + "-" + abbr(folder) + "-";
  const { data } = await S.sb.from("documents").select("code").like("code", prefix + "%");
  let max = 0;
  for (const r of data || []) max = Math.max(max, parseInt(r.code.slice(prefix.length), 10) || 0);
  return prefix + String(max + 1).padStart(3, "0");
}
function openDocForm(p, folders) {
  let mode = "file";
  const title = el("input", { id: "df-title", maxlength: "140", placeholder: "Software Requirements Specification v1.2" });
  const folder = el("select", { id: "df-folder" }, folders.map((f) => el("option", { value: f, text: f })));
  folder.value = S.folder !== "All" ? S.folder : folders[0];
  const file = el("input", { id: "df-file", type: "file" });
  const url = el("input", { id: "df-url", type: "url", placeholder: "https://company.sharepoint.com/…" });
  const note = el("input", { id: "df-note", maxlength: "200", placeholder: "Approved by client on 3 Nov" });
  file.addEventListener("change", () => { if (!title.value && file.files[0]) title.value = file.files[0].name.replace(/\.[^.]+$/, ""); });
  const fileField = field("File", file, "Any file type, up to 50 MB.");
  const urlField = field("Link", url, "A link to the document in SharePoint, Google Drive, Confluence or similar.");
  const segFile = el("button", { type: "button", "aria-pressed": "true" }, "Upload file");
  const segLink = el("button", { type: "button", "aria-pressed": "false" }, "Add link");
  const setMode = (m) => { mode = m; segFile.setAttribute("aria-pressed", m === "file"); segLink.setAttribute("aria-pressed", m === "link"); fileField.hidden = m !== "file"; urlField.hidden = m !== "link"; };
  segFile.addEventListener("click", () => setMode("file")); segLink.addEventListener("click", () => setMode("link"));
  const err = el("div", { class: "err", hidden: true });
  const save = el("button", { class: "btn primary", type: "submit" }, "Add document");
  const form = el("form", {},
    el("h3", { text: "Add a document to " + p.name }), el("div", { class: "seg" }, segFile, segLink), fileField, urlField,
    field("Title", title), field("Folder", folder), field("Note (optional)", note), err,
    el("div", { class: "modal-foot" }, el("button", { class: "btn", type: "button", onclick: closeModal }, "Cancel"), save));
  setMode(mode);
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); err.hidden = true;
    const fail = (m) => { err.textContent = m; err.hidden = false; save.disabled = false; save.textContent = "Add document"; };
    if (!title.value.trim()) return fail("Give the document a title.");
    const row = { project_id: p.id, folder: folder.value, title: title.value.trim(), note: note.value.trim(), kind: mode };
    save.disabled = true;
    let uploadedPath = null;
    if (mode === "file") {
      const f = file.files[0];
      if (!f) return fail("Choose a file to upload.");
      if (f.size > MAX_BYTES) return fail("This file is over 50 MB. Compress it or add it as a link.");
      save.textContent = "Uploading…";
      const safe = f.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120);
      uploadedPath = p.id + "/" + crypto.randomUUID() + "-" + safe;
      const up = await S.sb.storage.from(BUCKET).upload(uploadedPath, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (up.error) return fail("Upload failed: " + errText(up.error));
      Object.assign(row, { storage_path: uploadedPath, file_name: f.name, content_type: f.type || "application/octet-stream", size_bytes: f.size });
    } else {
      let u; try { u = new URL(url.value.trim()); } catch { return fail("Paste a full link starting with https://"); }
      if (!/^https?:$/.test(u.protocol)) return fail("Links must start with https://");
      row.url = u.href;
    }
    save.textContent = "Saving…";
    // Two people can pick the same next number at once; the database refuses the duplicate, so try a few times.
    let res;
    for (let i = 0; i < 3; i++) {
      row.code = await nextCode(p, folder.value);
      res = await S.sb.from("documents").insert(row).select().single();
      if (!res.error || res.error.code !== "23505") break;
    }
    if (res.error) {
      if (uploadedPath) await S.sb.storage.from(BUCKET).remove([uploadedPath]);
      return fail(errText(res.error));
    }
    closeModal(); toast(row.code + " added"); load();
  });
  openModal(false, form);
}

function confirmDeleteDoc(d) {
  const err = el("div", { class: "err", hidden: true });
  const del = el("button", { class: "btn danger solid", type: "button" }, "Remove document");
  del.addEventListener("click", async () => {
    del.disabled = true;
    const { error } = await S.sb.from("documents").delete().eq("id", d.id);
    if (error) { err.textContent = errText(error); err.hidden = false; del.disabled = false; return; }
    if (d.storage_path) await S.sb.storage.from(BUCKET).remove([d.storage_path]);
    closeModal(); toast(d.code + " removed"); load();
  });
  openModal(false, el("h3", { text: "Remove " + d.code + "?" }),
    el("p", { style: "margin:0;color:var(--muted)", text: "“" + d.title + "” will be removed from the register for everyone." + (d.kind === "file" ? " The uploaded file is deleted too and can't be recovered." : "") }), err,
    el("div", { class: "modal-foot" }, el("button", { class: "btn", type: "button", onclick: closeModal }, "Cancel"), del));
}

/* ---------- viewer ---------- */
async function openViewer(d) {
  const body = el("div", { class: "viewer-body" }, el("div", { class: "viewer-msg", text: "Loading " + (d.file_name || d.title) + "…" }));
  const dl = el("a", { class: "btn", hidden: true }, "Download");
  openModal(true,
    el("div", { class: "viewer-head" },
      el("div", {}, el("div", { class: "code", text: d.code }), el("h3", { text: d.title }), el("div", { class: "dnote", text: [d.file_name, fmtSize(d.size_bytes), d.folder, d.added_by_email].filter(Boolean).join(" · ") })),
      el("div", { class: "actions" }, dl, el("button", { class: "btn primary", type: "button", onclick: closeModal }, "Close"))),
    body);

  const [view, down] = await Promise.all([
    S.sb.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600),
    S.sb.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600, { download: d.file_name || true }),
  ]);
  if (view.error) { body.replaceChildren(el("div", { class: "viewer-msg", text: "The file couldn't be loaded: " + errText(view.error) })); return; }
  if (!down.error) { dl.href = down.data.signedUrl; dl.hidden = false; }

  const src = view.data.signedUrl;
  const type = d.content_type || "";
  const e = ext(d.file_name);
  if (type.startsWith("image/")) body.replaceChildren(el("img", { src, alt: d.title }));
  else if (type.startsWith("video/")) body.replaceChildren(el("video", { src, controls: true }));
  else if (type === "application/pdf" || e === "pdf") body.replaceChildren(el("iframe", { src, title: d.title }));
  else if (type.startsWith("text/") || type === "application/json" || TEXT_EXT.includes(e)) {
    try { const r = await fetch(src); body.replaceChildren(el("pre", { text: await r.text() })); }
    catch { body.replaceChildren(el("div", { class: "viewer-msg", text: "The file couldn't be loaded. Use Download instead." })); }
  } else {
    body.replaceChildren(el("div", { class: "viewer-msg", text: "Previews aren't available for ." + (e || "this") + " files. Use Download to open it on your computer." }));
  }
}
