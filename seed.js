import { randomInt } from 'node:crypto';
import { songLevels } from './songs-data.js';

export function shuffle(values) {
  const list = [...values];
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const frames = [
  ['RRR', 'Two men charge toward a clash, one framed by flames and the other by water.'],
  ['Baahubali: The Beginning', 'A man carries a large stone lingam through a river below a waterfall.'],
  ['Eega', 'A large fly faces a startled man.'],
  ['Pushpa: The Rise', 'A man in a rust-red shirt stands near a truck piled with timber in a forest.'],
  ['Magadheera', 'A warrior on a white horse rears above a battlefield.'],
  ['Arjun Reddy', 'A bearded surgeon stands alone in a hospital corridor.'],
  ['Jersey', 'A cricketer walks onto an empty pitch in his batting gear.'],
  ['Kalki 2898 AD', 'An armored man stands in a desert below an enormous floating city.'],
  ['Hanu-Man', 'A man holds a glowing red gem below the silhouette of Hanuman.'],
  ['Sita Ramam', 'An army officer holds a handwritten letter against a snowy mountain landscape.'],
];

export const spoken = [
  ['Rangasthalam', 'In a village by the Godavari, a mechanic who struggles to hear takes on a powerful village president.'],
  ['Athadu', 'A hitman on the run takes the identity of a stranger and finds himself welcomed into that man’s family.'],
  ['Pokiri', 'A seemingly ruthless gangster has been hiding his real identity as a police officer.'],
  ['Bommarillu', 'A young man with a controlling father invites the woman he loves to spend a week with his family.'],
  ['Mahanati', 'A journalist retraces the life and career of the legendary actress Savitri.'],
  ['Awe!', 'A cook talks to a fish and a bonsai tree. A café ties several strangers together.'],
  ['Kshanam', 'A man returns from America to help his former girlfriend find her missing daughter.'],
  ['C/o Kancharapalem', 'Four love stories unfold in a Vizag neighborhood, from schoolchildren to a man in his forties.'],
  ['Leader', 'After his father is assassinated, a young man enters politics and tries to fight corruption.'],
  ['Agent Sai Srinivasa Athreya', 'A small-time detective in Nellore investigates unidentified bodies found by railway tracks.'],
];

const lyrics = [
  ['RRR', 'Naatu Naatu'],
  ['Pushpa: The Rise', 'Srivalli'],
  ['Sita Ramam', 'Inthandham'],
  ['Ala Vaikunthapurramuloo', 'Samajavaragamana'],
  ['Fidaa', 'Vachinde'],
  ['Jersey', 'Adhento Gaani Vunnapaatuga'],
  ['Geetha Govindam', 'Inkem Inkem Inkem Kaavaale'],
  ['Arjun Reddy', 'Madhurame'],
  ['Bommarillu', 'Appudo Ippudo'],
  ['Rangasthalam', 'Yentha Sakkagunnave'],
];

const emojis = [
  ['Eega', '🪰 🔁 😡'],
  ['Jersey', '🏏 👨‍👦 🏟️'],
  ['Sita Ramam', '💌 🪖 ❄️'],
  ['Kalki 2898 AD', '🏜️ 🤖 🛸'],
  ['Hanu-Man', '🐒 💎 💪'],
  ['Mahanati', '🎥 👸 🌟'],
  ['Karthikeya 2', '🐍 🦚 🛕'],
  ['Bimbisara', '👑 🪞 ⏳'],
  ['Happy Days', '🎒 👩‍🎓 🫂'],
  ['Pelli Choopulu', '💍 🚚 🍲'],
];

const photoNames = {
  "hero": [
    "Prabhas",
    "Mahesh Babu",
    "Allu Arjun",
    "Ram Charan",
    "N.T. Rama Rao Jr.",
    "Pawan Kalyan",
    "Nani",
    "Nagarjuna Akkineni",
    "Ravi Teja",
    "Nandamuri Balakrishna",
    "Rana Daggubati",
    "Vijay Deverakonda",
    "Naga Chaitanya Akkineni",
    "Varun Tej",
    "Sai Dharam Tej",
    "Nithiin",
    "Sharwanand",
    "Adivi Sesh",
    "Nikhil Siddharth",
    "Sundeep Kishan"
  ],
  "heroine": [
    "Samantha Ruth Prabhu",
    "Anushka Shetty",
    "Kajal Aggarwal",
    "Keerthy Suresh",
    "Rashmika Mandanna",
    "Pooja Hegde",
    "Tamannaah Bhatia",
    "Sai Pallavi",
    "Trisha Krishnan",
    "Nayanthara",
    "Kiara Advani",
    "Sreeleela",
    "Raashi Khanna",
    "Rakul Preet Singh",
    "Nithya Menen",
    "Mehreen Pirzada",
    "Anupama Parameswaran",
    "Mrunal Thakur",
    "Nabha Natesh",
    "Shriya Saran"
  ]
};

const plots = [
  ['Eega', 'One man spends a fortune on security and still can’t keep a fly out of his house.'],
  ['Baahubali: The Beginning', 'A guy climbs a waterfall and finds out the palace has been waiting for him to come home.'],
  ['Jersey', 'A dad takes his kid’s request for a jersey so seriously that he goes back to professional cricket.'],
  ['Ala Vaikunthapurramuloo', 'An employee swaps two babies and spends the next couple of decades hoping nobody audits the nursery.'],
  ['Athadu', 'A hitman borrows a dead stranger’s name and inherits a whole family.'],
  ['Bommarillu', 'A man runs a one-week trial for his girlfriend because his dad insists on being the hiring manager.'],
  ['Maryada Ramanna', 'A houseguest realizes the front door is the most dangerous part of a very hospitable family’s home.'],
  ['Sita Ramam', 'A woman tries to deliver a decades-old love letter and ends up doing detective work across borders.'],
  ['Jathi Ratnalu', 'Three roommates try to start over in Hyderabad and accidentally turn their job hunt into a criminal trial.'],
  ['Kalki 2898 AD', 'A bounty hunter takes a job with a huge payout and discovers an immortal has already claimed the client.'],
];

const memes = [
  ['Kill Bill Pandey', 'A swaggering cop in khaki points at you from in front of his jeep.', ['Kill Bill Pande', 'Kill Bill', 'Pandey'], 'Race Gurram’s emergency police backup.'],
  ['Khan Dada', 'A gangster in a loud shirt raises a warning finger in a street.', ['Khan Daada', 'Khan Dada from Money'], 'The local don from Money.'],
  ['Gajala', 'A nervous man holds up his palm on a train’s blue bench seat.', ['Gazala', 'Gajala from Washington DC'], 'The very unlucky passenger from Venky.'],
  ['McDowell Murthy', 'An anxious accountant clutches a ledger in a family home.', ['McDowell Murthy Garu', 'Mc Dowell Murti', 'Murthy', 'Murthy Garu'], 'The accountant caught up in the family mix-up in Ready.'],
  ['Padmasri', 'A proud man points at himself while a camcorder records him.', ['Padmashri', 'Padma Sri', 'Padma Shri'], 'The aspiring reality-TV star from Dookudu.'],
  ['Chari', 'A puzzled priest in a white dhoti holds a brass puja plate.', ['Chary', 'Adhurs Chari'], 'The priest with a lookalike in Adhurs.'],
  ['Padmanabha Simha', 'A police officer leans back and waves off a warning at his desk.', ['Padmanabha Singh', 'Padmanabha Simha IPS'], 'The overconfident cop from Baadshah.'],
  ['Thokka Thotakura', 'A man gives a dismissive side-eye and sweeps his hand to the side.', ['Thokka Thotakoora', 'Thokka Totakura', 'Tokka Totakura'], 'Sunil’s dismissive reaction from Parugu.'],
  ['Chitti', 'A confused lawyer holds up a case file in court.', ['Chitti Lawyer', 'Lawyer Chitti'], 'The courtroom defender from Jathi Ratnalu.'],
  ['DJ Tillu', 'A DJ with curly hair and tinted glasses holds a headphone to one ear.', ['Tillu', 'Atluntadi Manathoni', 'Atluntadhi Manathoni'], 'The Hyderabad DJ who’s always in a situation.'],
];

const movieAliases = {
  RRR: ['Rise Roar Revolt', 'ఆర్ఆర్ఆర్'],
  'Baahubali: The Beginning': ['Baahubali', 'Bahubali', 'Baahubali 1', 'Bahubali The Beginning', 'బాహుబలి'],
  'Pushpa: The Rise': ['Pushpa', 'Pushpa 1', 'పుష్ప'],
  'Sita Ramam': ['Seetha Ramam', 'Sita Raman', 'సీతా రామం'],
  'Kalki 2898 AD': ['Kalki', 'కల్కి'],
  'Ala Vaikunthapurramuloo': ['Ala Vaikunthapuramulo', 'Ala Vaikuntapuramlo', 'Ala Vaikunthapurramulo', 'AVPL', 'అల వైకుంఠపురములో'],
  'C/o Kancharapalem': ['Care of Kancharapalem', 'Kancharapalem'],
  'Agent Sai Srinivasa Athreya': ['Agent Sai Srinivasa Atreya', 'Agent Sai', 'ASSA'],
  'Karthikeya 2': ['Kartikeya 2', 'Karthikeya Two'],
  'Pelli Choopulu': ['Pelli Chupulu', 'Pellichoopulu'],
  Eega: ['ఈగ'],
  Jersey: ['జెర్సీ'],
  Rangasthalam: ['రంగస్థలం'],
  Mahanati: ['మహానటి'],
  Magadheera: ['మగధీర'],
  Athadu: ['అతడు'],
  Pokiri: ['పోకిరి'],
  Bommarillu: ['బొమ్మరిల్లు'],
  Fidaa: ['Fida', 'ఫిదా'],
};

export function starterAliases(answer) {
  return Object.hasOwn(movieAliases, answer) ? movieAliases[answer] : [];
}

function photoSets() {
  const titles = { hero: 'Tollywood Leading Men', heroine: 'Tollywood Leading Women' };
  return Object.entries(photoNames).flatMap(([mode, all]) => [0, 1].map(part => {
    const names = all.slice(part * 10, part * 10 + 10);
    return {
      id: `starter-${mode}-${part + 1}`, industry: 'tollywood', mode, title: `${titles[mode]} ${part + 1}`, starter: true,
      questions: names.map((answer, i) => {
        const options = shuffle([answer, ...shuffle(names.filter(name => name !== answer)).slice(0, 3)]);
        return {
          media: `/media/${mode}-${part * 10 + i + 1}.jpg`, alt: 'Portrait photo. The name is revealed after the countdown.',
          aliases: [], options, correct: options.indexOf(answer),
        };
      }),
    };
  }));
}

export function starterSets() {
  return [...photoSets(), ...songSets(), ...regularSets()];
}

function songSets() {
  return songLevels.map((level, index) => ({
    id: `starter-song-${String(index + 1).padStart(2, '0')}`, industry: 'tollywood', mode: 'song', title: `Level ${index + 1}`, starter: true,
    questions: level.map(song => {
      const options = shuffle([song.title, ...shuffle(level.map(other => other.title).filter(title => title !== song.title)).slice(0, 3)]);
      const { title, ...details } = song;
      delete details.id; delete details.replay;
      return {
        media: `/media/song-${song.id}.mp3`, alt: 'A five-second vocal clip. The song is revealed after listening.',
        details, aliases: [], options, correct: options.indexOf(title),
      };
    }),
  }));
}

function regularSets() {
  return [
    ['frame', 'Scenes of Tollywood', frames, (_, i) => ({ media: `/media/frame-${i + 1}.webp` })],
    ['audio', 'Tollywood by Ear', spoken, (_, i) => ({ media: `/media/audio-${i + 1}.mp3` })],
    ['lyric', 'Tollywood Hooks', lyrics, text => ({ text })],
    ['emoji', 'Tollywood in Emojis', emojis, text => ({ text })],
    ['plot', 'Plot Summaries Gone Wrong', plots, text => ({ text })],
    ['meme', 'Tollywood Meme Classics', memes, (alt, i, text) => ({ media: `/media/meme-${i + 1}.webp`, alt, text })],
  ].map(([mode, title, entries, clue]) => ({
    industry: 'tollywood', mode, title, starter: true,
    questions: entries.map(([answer, hint, aliases = starterAliases(answer), context], i) => {
      const options = shuffle([answer, ...shuffle(entries.map(([name]) => name).filter(name => name !== answer)).slice(0, 3)]);
      const alt = mode === 'frame' || mode === 'audio' ? hint : '';
      return { alt, ...clue(hint, i, context), aliases, options, correct: options.indexOf(answer) };
    }),
  }));
}
