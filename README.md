# Movie Games Adda

A black-and-red film quiz for phones and laptops. The Tollywood launch has one ten-question set each for Frames, Lyrics, Emojis, Badly Explained Plot, and Guess the Meme as coming soon, plus live Guess the Actor, Guess the Actress, Guess the Movie (one film frame, typed answer) and Guess the Song games with ten-question levels. Players choose multiple choice or typed answers when starting a round.

## Run locally

Requires Node.js 24 or later. There are no npm dependencies to install.

```sh
npm start
```

Open [the game](http://127.0.0.1:3000) or [the admin panel](http://127.0.0.1:3000/admin). The startup terminal prints a temporary local admin password. To use your own password, set `ADMIN_PASSWORD` to at least 12 characters before starting.

## Publish more rounds

1. Sign in at `/admin` and choose **New question set**.
2. Choose a film industry and a game. Fill all ten questions, each with four distinct answers and one marked correct.
3. Upload a still, meme picture, or audio clip for each media question and provide an accessible description or transcript. The upload limit is 8 MB per file. The other games use text clues. Add alternate spellings or names for typed answers where appropriate.
4. Choose **Save draft** or **Publish set**. Published sets are immediately available. A published set can be archived while any rounds already underway remain playable.

The admin can add industries and import multiple complete sets as JSON. The JSON structure is an array of sets, each with `industry`, `mode` (`frame`, `audio`, `lyric`, `emoji`, `hero`, `heroine`, `plot`, or `meme`), `title`, and `questions`. Each question has `options` (four strings), `correct` (a zero-based option index), and optional `aliases` (an array of up to 12 accepted typed answers). Text clues use `text`. Media clues use `media` (an uploaded path) and `alt` (description or transcript). Meme clues can include a caption in `text`.

Play Again selects an unseen set in the same industry and mode. It shows a caught-up message once the player has exhausted the available sets. Progress follows the browser cookie. You can publish 20 or more sets per mode without changing the application. Duplicate detection compares normalized text or identical file bytes within an industry and mode.

The starter frame and meme images are illustrated recreations, the starter audio is original narration, and the lyric round uses short Tollywood song hooks.

## Hosting

Run the Node process behind HTTPS and point the intended domain at the host. Set `HOST=0.0.0.0`, `PORT`, `ADMIN_PASSWORD`, and `COOKIE_SECURE=1`. Set `DATA_DIR` to a persistent volume for the SQLite database, which stores sets, uploads, and play history. Back up that database before migrating or replacing the host.

Run `npm test` to verify round progress, scoring, publishing, duplicate checks, and industry isolation.

## Guess the Movie by Frames levels

The 24 levels come from `images_with_dialogues/` (collages of two to six frames from one scene, with the dialogue). Run `python3 tools/build-frames.py` (needs Pillow and NumPy) to rebuild them: it keeps only clearly visible collages (no black bars at the edges or between frames, nothing too dark or flat), skips template and promo posts, puts ten different movies in each level, resizes the stills into `public/media/frames/`, and writes `frames-data.js`. Movie names and alternate spellings live in the script's `M` table. Players type the movie name against a 20-second timer, the same typed, forgiving-spelling answers and Pass button as Guess the Actor. After they answer, the movie name and the scene's dialogue are shown.
