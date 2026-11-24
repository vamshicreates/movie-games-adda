export const modes = {
  hero: { name: 'Guess the Actor', desc: 'A photo of a Tollywood star. Pick his name from four, or type it.', label: 'Actor', prompt: 'Who is this actor?', clue: 'image', reveal: true, typedGuess: true, levels: true, unit: 'photos' },
  heroine: { name: 'Guess the Actress', desc: 'A photo of a Tollywood star. Pick her name from four, or type it.', label: 'Actress', prompt: 'Who is this actress?', clue: 'image', reveal: true, typedGuess: true, levels: true, unit: 'photos' },
  song: { name: 'Guess the Song', desc: 'Five seconds of vocals. Pick the song from four, or type its name.', label: 'Song', prompt: 'Do you know this song?', clue: 'audio', reveal: true, levels: true, unit: 'songs' },
  frame: { name: 'Guess the Movie by Frames', desc: 'Two frames from one scene. Pick the movie from four, or type its name.', label: 'Frame', prompt: 'Which movie is this scene from?', clue: 'image', reveal: true, typedGuess: true, scene: true, levels: true, unit: 'frames', answerWord: 'movie', seconds: 20 },
  lyric: { name: 'Guess by Lyrics', desc: 'Read the lyric and match it to the film.', label: 'Lyrics', prompt: 'Which movie features this song?', soon: true },
  emoji: { name: 'Guess by Emojis', desc: 'Decode the emojis to name the movie.', label: 'Emojis', prompt: 'Which movie do these emojis describe?', soon: true },
  plot: { name: 'Badly Explained Plot', desc: 'Name the movie from a ridiculous synopsis.', label: 'Plot', prompt: 'Which movie is this badly explained plot about?', soon: true },
  meme: { name: 'Guess the Meme', desc: 'Recognize the character or meme template.', label: 'Meme', prompt: 'What is this meme or character called?', clue: 'image', soon: true },
};

export const answerFormats = {
  multiple: { label: 'Pick the answer', description: 'Choose from four answers.' },
  reveal: { label: 'Guess & reveal', description: 'Study a blurred photo, then reveal it and score yourself.' },
  typed: { label: 'Type the answer', description: 'No choices. Type your guess.' },
};
