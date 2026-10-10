# when3meet

A cleaner, simple, **when2meet-style** scheduler that runs as a static website.

## What this includes

- No backend required (pure HTML/CSS/JS)
- A weekly availability grid
- Multiple participants, each with their own color
- Click-and-drag style slot selection (click to toggle cells)
- Slot summary counts to quickly spot best meeting times
- Shareable URL state (copy/paste link)

## Run locally

Open `index.html` directly in your browser, or serve the repo:

```bash
cd /home/runner/work/when3meet/when3meet
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Host publicly with GitHub Pages

1. Push this repository to GitHub.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set:
   - **Source**: *Deploy from a branch*
   - **Branch**: your default branch (for example `main`) and folder `/ (root)`
4. Save. GitHub will publish your site and give you a public URL.

That URL can be shared with anyone so they can use the scheduler.
