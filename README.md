# Work Queue

A personal task app for Windows with lists, profiles, My Day, history and streaks,
reminders, and two looks (Fun and Work). It installs like any other app and keeps
itself up to date.

This README is the only guide. It replaces all the earlier ones.

---

## Install (one time, about 15 minutes)

Automatic updates need somewhere to publish new versions. The free, standard place
is GitHub: it builds the installer for you on its own Windows computers, so you
don't need Node.js or any build tools on your PC.

### 1. Put the project on GitHub

1. Create a free account at **github.com** if you don't have one.
2. Click **+** (top right) → **New repository**. Name it `work-queue`, choose
   **Public**, and leave "Add a README" unticked. Click **Create repository**.
   - Public is required for updates to download without a password. Only the app's
     code goes there. Your tasks never leave your PC.
3. On the new repository's page, click **uploading an existing file**. Drag in
   **everything inside this folder**, including the `.github` folder, then click
   **Commit changes**.
   - If the `.github` folder doesn't come through: click **Add file** → **Create
     new file**, type `.github/workflows/release.yml` as the name, paste in the
     contents of that file from this folder, and click **Commit changes**.

### 2. Build the installer

1. Open the **Actions** tab. If GitHub asks, click the button to enable workflows.
2. Click **Build and publish Work Queue** → **Run workflow**. Type `2.0.0` as the
   version and click **Run workflow**.
3. Wait for the green check, about 5 to 10 minutes.
4. Go back to the **Code** tab and click **Releases** on the right. Download
   **Work-Queue-Setup-2.0.0.exe**.

### 3. Install

Run the downloaded file. Because the app isn't code-signed, Windows may show
"Windows protected your PC". Click **More info** → **Run anyway**.

It installs for your account (no administrator needed), adds shortcuts to the
Desktop and Start menu, and opens Work Queue.

---

## Moving over from the old folder version

1. In the old version, untick **Start on login**, then right-click the tray icon →
   **Quit**.
2. Install the new version as above. Your tasks, profiles, templates and backups
   carry over automatically, because both versions use the same data folder.
3. Delete the old `work-queue-desktop` folder and any old shortcuts. You no longer
   need Node.js, so you can uninstall it too.
4. In the new app, tick **Start on login** if you want it.

---

## Updates

**They happen on their own.** Work Queue checks for a new version when it starts and
every 4 hours, downloads it in the background, then shows **Restart now**. If you
choose Later, it installs the next time you quit. You can also use **Check now** in
**Settings** (the ⚙ button, top right) or **Check for updates** in the tray menu.
The version you're running is shown next to the title (click it to open the update
controls), and the first time Work Queue opens after an update, a note at the top says
which version it updated to. Every release shows its own number automatically: it's
the number you type when you run the workflow.

**Publishing a new version** (for example, when you get updated files):

1. On GitHub, click **Add file** → **Upload files**, drag in the changed files, and
   click **Commit changes**.
2. **Actions** → **Build and publish Work Queue** → **Run workflow**, with a version
   number higher than the last one (2.0.1, 2.0.2, and so on).

Installed copies pick it up within a few hours, or right away with Check now.

---

## Your data

- Everything is saved automatically to `%AppData%\WorkQueue\work-queue-data.json`.
  Paste `%AppData%\WorkQueue` into File Explorer's address bar to open the folder.
- **Daily backups:** each day, the app copies your data to the `backups` folder in
  that location and keeps the last 14 days. To restore one, open **Settings** →
  **Restore a backup**, or use **Restore from backup** in the tray menu. Your current
  data is saved first, so a restore can be undone.
- **Export backup** and **Import backup** save or load one profile as a file.
- Updating or uninstalling never deletes your data.

---

## Uninstall

**Settings** → **Apps** → **Installed apps** → **Work Queue** → **Uninstall**.
Your data stays. To remove it too, delete the `%AppData%\WorkQueue` folder.

---

## Features at a glance

- **My Day:** the tab before Main. Tap the sun on any task to plan it for today. The
  list starts fresh each morning, with suggestions for anything overdue, due today,
  or left over from yesterday.
  Unfinished tasks wait in the next day's suggestions, or turn on **Settings → My Day →
  Carry unfinished tasks over to the next day** to roll them forward automatically
  (a "↪ since" chip shows how long one has been carried).
- **Planner:** the tab next to My Day shows the next 7 days. Drag tasks onto a day,
  use a task's Plan menu, or type a new task straight onto a day; each one appears
  in My Day on its day, by itself. Missed plans and later plans are listed too, and
  the arrows move between weeks. You can also set "Plan for My Day" in a task's
  editor, or plan several selected tasks at once.
- **Adding while a context is selected:** pick a context chip (for example @Calls) and
  new tasks get that context automatically, so they stay in view. The add box says
  "Add a task to @Calls"; untick it in the form for any task that shouldn't have it.
- **Select several:** click **Select**, or Ctrl-click or Shift-click tasks, then
  complete, add to My Day, add to a list, change urgency, snooze, copy or delete them
  together. Press Esc when you're done.
- **Sub-tasks:** add steps while you add a task (open the add form) or later in the
  editor. Enter adds a step; Shift+Enter starts a new line inside it, and steps can
  be as long as you like. Pasting a bulleted or numbered list adds each item as its
  own step; pasting plain text keeps it together as one step.
- **Templates:** open a task and choose **Save as template**. Add it again any time
  from **From template** next to Add task. Templates keep sub-tasks, repeats and
  links.
- **Links and files:** open a task to paste a web link or file path, use **Attach
  file**, or drag a file onto the task. Open them from the link chip on the card.
- **Copy list:** copies the tasks on screen as a checklist for email or Teams. With
  tasks selected, **Copy** copies just those.
- **Search and shortcuts:** N new task, / search, Esc close, Ctrl+Z undo, and
  Ctrl+Shift+Space to show or hide Work Queue from any app.
- **Repeats:** daily, every few days, weekly, monthly on the same date, or on
  specific weekdays. Snooze by a day or a week.
- **History and streaks:** a 30-day activity strip, day streaks, and a day-by-day log.
- **Reminders:** a daily reminder time, or a time per task, for every profile.
- **Profiles and sharing:** separate profiles, with Copy, Move or Share with
  everyone on each task.
- **Looks and themes:** Fun or an Office-style Work look, each in Light, Dark or
  System.
- **Settings:** the ⚙ button holds the look, theme, reminders, contexts, Start on
  login, window modes, backups, updates and keyboard shortcuts.
- **Archive:** finished one-off tasks move to an archive after 90 days. They still
  count in History and show up in search, where Restore brings them back.
- **Window modes:** Normal, Float on top, Widget (in front of or behind other
  windows), or Glue on the wallpaper.

---

## Troubleshooting

- **The workflow failed.** Open the failed run in the Actions tab to see why. The
  usual cause is reusing a version number, so run it again with a higher one. If it
  mentions permissions, go to **Settings** → **Actions** → **General** → **Workflow
  permissions**, choose **Read and write permissions**, and save.
- **No updates arrive.** Make sure the repository is Public and the new version
  number is higher than the installed one (shown in Settings).
- **"Automatic updates aren't set up for this copy."** That copy was built on a PC
  rather than by the workflow. Install the version from the Releases page instead.
- **Ctrl+Shift+Space does nothing.** Another app already uses that shortcut.
- **Windows blocks the installer.** Click **More info** → **Run anyway**. It's
  unsigned, not unsafe.

---

## For tinkering (optional)

You only need this to change the app yourself.

- Everything you see is in `index.html`. Desktop-only parts (tray, window modes,
  updates, files) are in `main.js` and `preload.js`.
- To run from the source: install Node.js LTS, then run `npm install` and
  `npm start` in this folder.
- To build an installer on your own PC: `npm run dist`. It lands in `dist/`. It
  won't auto-update, and Windows may need Developer Mode turned on for the build.
