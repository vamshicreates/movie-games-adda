export const modes = {
  hero: { name: 'Guess the Actor', desc: 'A blurred photo, ten seconds. Type his name.', label: 'Actor', prompt: 'Who is this actor?', clue: 'image', reveal: true, typedGuess: true, levels: true, unit: 'photos' },
  heroine: { name: 'Guess the Actress', desc: 'A blurred photo, ten seconds. Type her name.', label: 'Actress', prompt: 'Who is this actress?', clue: 'image', reveal: true, typedGuess: true, levels: true, unit: 'photos' },
  song: { name: 'Guess the Song', desc: 'Five seconds of vocals. Do you know the song?', label: 'Song', prompt: 'Do you know this song?', clue: 'audio', reveal: true, levels: true, unit: 'songs' },
  frame: { name: 'Guess by Frame', desc: 'Name the movie from a single scene.', label: 'Frame', prompt: 'Which movie is this scene from?', clue: 'image', soon: true },
  lyric: { name: 'Guess by Lyrics', desc: 'Read the lyric and match it to the film.', label: 'Lyrics', prompt: 'Which movie features this song?', soon: true },
  emoji: { name: 'Guess by Emojis', desc: 'Decode the emojis to name the movie.', label: 'Emojis', prompt: 'Which movie do these emojis describe?', soon: true },
  plot: { name: 'Badly Explained Plot', desc: 'Name the movie from a ridiculous synopsis.', label: 'Plot', prompt: 'Which movie is this badly explained plot about?', soon: true },
  meme: { name: 'Guess the Meme', desc: 'Recognize the character or meme template.', label: 'Meme', prompt: 'What is this meme or character called?', clue: 'image', soon: true },
};

export const answerFormats = {
  multiple: { label: 'Multiple choice', description: 'Pick from four answers.' },
  reveal: { label: 'Guess & reveal', description: 'Study a blurred photo, then reveal it and score yourself.' },
  typed: { label: 'Type your answer', description: 'Make your guess without seeing the choices.' },
};
