export const modes = {
  frame: { name: 'Guess by Frame', desc: 'Name the movie from a single scene.', label: 'Frame', prompt: 'Which movie is this scene from?', clue: 'image' },
  audio: { name: 'Guess by Audio', desc: 'Listen closely and name the movie.', label: 'Audio', prompt: 'Which movie does this audio clue describe?', clue: 'audio' },
  lyric: { name: 'Guess by Lyrics', desc: 'Read the lyric and match it to the film.', label: 'Lyrics', prompt: 'Which movie features this song?' },
  emoji: { name: 'Guess by Emojis', desc: 'Decode the emojis to name the movie.', label: 'Emojis', prompt: 'Which movie do these emojis describe?' },
  hero: { name: 'Guess the Hero', desc: 'Name the actor from his roles.', label: 'Hero', prompt: 'Which actor played these roles?' },
  heroine: { name: 'Guess the Heroine', desc: 'Name the actress from her roles.', label: 'Heroine', prompt: 'Which actress played these roles?' },
  plot: { name: 'Badly Explained Plot', desc: 'Name the movie from a ridiculous synopsis.', label: 'Plot', prompt: 'Which movie is this badly explained plot about?' },
  meme: { name: 'Guess the Meme', desc: 'Recognize the character or meme template.', label: 'Meme', prompt: 'What is this meme or character called?', clue: 'image' },
};

export const answerFormats = {
  multiple: { label: 'Multiple choice', description: 'Pick from four answers.' },
  typed: { label: 'Type your answer', description: 'Make your guess without seeing the choices.' },
};
