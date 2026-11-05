# Project Document Register

A website for storing every project's documents: projects, folders, uploaded files and links, with automatic document numbers like `CRM-REQ-001`.

It costs nothing to run:

| Part | Service | Free tier |
|---|---|---|
| Website | GitHub Pages | Free for public repositories |
| Database, file storage, sign-in | Supabase | 500 MB database, 1 GB file storage, 50 MB per file |

Only people you add can sign in. Nobody can create their own account.

## Files

| File | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The website |
| `config.js` | Your Supabase address and public key (you fill this in) |
| `supabase/schema.sql` | Creates the tables, the file bucket and the access rules |

## Setup (about 15 minutes, one time)

### 1. Create the Supabase project

1. Go to https://supabase.com and sign up (free, no card needed).
2. Click **New project**. Pick a name (for example `project-docs`), set a database password, and choose the region closest to you (for example Mumbai). Wait about 2 minutes while it's created.

### 2. Create the tables and the file storage

1. In Supabase, open **SQL Editor** → **New query**.
2. Paste the whole contents of `supabase/schema.sql` and click **Run**. You should see "Success. No rows returned".

### 3. Turn off public sign-ups and add your users

1. Open **Authentication** → **Sign In / Providers**. Under **Email**, keep it enabled and turn **off** "Allow new users to sign up". Save.
2. Open **Authentication** → **Users** → **Add user** → **Create new user**.
3. Enter the person's email and a password, tick **Auto Confirm User**, and click **Create user**.
4. Repeat for yourself, your MD and anyone else who needs access. Give each person their password privately.

### 4. Connect the website to Supabase

1. In Supabase, open **Project Settings** → **API** (or **Data API**).
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` and replace `https://YOUR-PROJECT-ID.supabase.co` and `YOUR-ANON-PUBLIC-KEY` with those two values.

The anon key is meant to be public. The access rules in `schema.sql` only let signed-in users read or change anything. **Never** put the `service_role` key in this file.

### 5. Publish on GitHub Pages

1. Sign in at https://github.com and click **New repository**. Name it, for example `project-docs`, set it to **Public** (Pages is free for public repositories), and create it.
2. Click **uploading an existing file**, drag in `index.html`, `styles.css`, `app.js`, `config.js`, `README.md` and the `supabase` folder, then click **Commit changes**.
3. Open the repository's **Settings** → **Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and click **Save**.
4. After a minute or two the page shows your link, for example `https://your-username.github.io/project-docs/`.

Send that link to your MD along with their email and password.

> A public repository means anyone can read the website's code. That's fine: the code has no passwords, and your documents live in Supabase behind sign-in, not in the repository.

## Day-to-day

- **Add someone:** Supabase → Authentication → Users → Add user.
- **Remove someone:** Supabase → Authentication → Users → pick the user → Delete user.
- **Reset a password:** Supabase → Authentication → Users → pick the user → Send password recovery, or delete the user and add them again.
- **See storage use:** Supabase → Project Settings → Usage.

## Good to know

- On the free tier, Supabase **pauses a project after 7 days with no activity**. Opening the site doesn't wake it. Sign in to supabase.com and click **Restore project** (it takes about a minute, and no data is lost). Regular use keeps it awake.
- Previews work in the browser for PDFs, images, videos and text files. Word, Excel and other files open with **Download**.
- Everyone who can sign in can add, edit and remove documents.
