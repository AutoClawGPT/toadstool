# Toadstool ($TOADSTOOL)

Not a mushroom. A toad, on a bar stool, waiting on a bid since launch.

**Live site:** https://toadstool-coin.vercel.app

A static, framework-free pitch page (HTML, CSS, a little JS): a dim dive bar at night, one green neon sign, a "Ring the bell" button that makes the toad react, a live waiting timer, a meme menu with click-to-enlarge, and the house rules.

## Things to poke

- **Ring the bell**: bell ding, the toad reacts. Ring it five times for last call (neon flashes, bubbles and flies rise).
- **Tap the toad**: he croaks, puffs up, and says something deadpan.
- **Catch the fly**: it buzzes around the hero. Tap it to feed the toad (tongue flick, gulp, croak). Flies eaten are counted.
- **Jukebox**: optional low-volume bar hum and a quiet chord loop, off by default.
- **Check the tab**: a receipt for your visit, paid in flies.

All sounds are synthesized live with the Web Audio API (no audio files). They start only after your first tap or key press, and the speaker button in the corner turns them off.

## Files

- `index.html` – the page
- `style.css` – styles
- `app.js` – bell, timer, lightbox
- `vercel.json` – cache headers for images

## Images

The images are not stored in this repo. They are served from the live site:

- https://toadstool-coin.vercel.app/logo.jpg
- https://toadstool-coin.vercel.app/hero.jpg
- https://toadstool-coin.vercel.app/wait.jpg
- https://toadstool-coin.vercel.app/mushroom.jpg
- https://toadstool-coin.vercel.app/bid.jpg
- https://toadstool-coin.vercel.app/favicon.ico, /icon-32.png, /apple-touch-icon.png

To run locally, download those files into the same folder as `index.html` and serve the folder with any static server.

## House rules

- One toad. One stool. No mushrooms.
- The stool does not move.
- Tips accepted in flies.

Toadstool. A meme, not a promise.
