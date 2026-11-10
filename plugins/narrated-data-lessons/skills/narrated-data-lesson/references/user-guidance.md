# Working with the user

Assume a non-technical user. Be warm, brief and concrete. One step at a time; say what
they'll see and what to click. Never ask them to edit code, JSON or run commands unless
they want to; you run things. Confirm before anything that costs money, publishes, or
uses their accounts.

## What to tell them up front
"Here's how this will go: I'll check your data, suggest the best kind of animated chart,
draft a short script for you to approve, show you a preview, then record the narration
with ElevenLabs (you'll need to sign in) and polish it with you."

## Walkthroughs

### Getting data from a link that won't download
"The site blocks automatic downloads, so let's grab it by hand:
1. Open the link in your browser.
2. Look for a button like **Download**, **Export** or **CSV** (often near the table or at the top right).
3. Save the file, then drag it into this chat (or tell me where you saved it)."

### Data in a PDF
"I can read tables inside a PDF. If the numbers are only in charts or paragraphs, I can't
read them reliably. In that case, look for a 'data' or 'download' link near where you found it."

### ElevenLabs (narration and music)
"ElevenLabs makes the narrator's voice. You'll need an account; a paid plan is best if
you'll share the lesson publicly (check their terms for your plan).
1. Go to **elevenlabs.io** and sign in (or create an account).
2. Tell me when you're signed in. I'll set the voice and paste the script, or I'll tell you
   exactly what to click:
   - **Text to Speech** (left menu) → **Voice**: search **Quentin**, pick **Quentin – Narrator and Educator**
   - **Model**: Eleven v4 · **Stability**: about 80% · **Language**: English
   - paste the script → **Generate speech** → download the first take (the ↓ icon)
3. For music: **Music** (left menu) → paste the music prompt I give you → set length to 2:00 and
   Lyrics to **Instrumental** → generate → download as MP3."
If they don't want an account: offer the free placeholder voice (Mac) or a silent preview.

### Previewing on their computer
"I'll start a small local preview. Open **http://localhost:8123/<lesson-folder>/** in your
browser. Press play to watch; click **Explore** to try it yourself."

### Publishing (GitHub Pages)
"To share it with a link:
1. Make a free account at **github.com** if you don't have one.
2. Create a new **public** repository (the **+** at the top right → **New repository**).
3. I'll upload the lesson folder for you (or walk you through **Add file → Upload files**).
4. In the repository: **Settings → Pages → Branch: main → Save**. After a minute your lesson
   is live at `https://<username>.github.io/<repository>/<lesson-folder>/`."

## Reporting progress
After each step: what was done, what was checked, what's next, and anything that needs them.
Keep it to a few sentences.
