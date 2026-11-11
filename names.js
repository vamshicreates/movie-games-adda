// Forgiving name matching for Guess the Actor / Guess the Actress.
// A guess counts when it is clearly closest to the right person among the ten in the level,
// whatever the spelling: "Prabs" for Prabhas, "Jr NTR" for N.T. Rama Rao Jr., "Sai Pallavi" for Sai Pallavi.

// Other names people use, by the name shown on the answer.
export const nameAliases = {
  'Prabhas': ['Prabhas Raju', 'Darling', 'Rebel Star', 'Prabhas Uppalapati'],
  'Mahesh Babu': ['Mahesh', 'Prince', 'Superstar Mahesh', 'Ghattamaneni Mahesh Babu'],
  'Allu Arjun': ['Arjun', 'AA', 'Bunny', 'Stylish Star', 'Icon Star', 'Alu Arjun'],
  'Ram Charan': ['Charan', 'RC', 'Mega Power Star', 'Cherry'],
  'N.T. Rama Rao Jr.': ['NTR', 'Jr NTR', 'Junior NTR', 'NTR Jr', 'NTR Junior', 'Tarak', 'Young Tiger', 'Nandamuri Taraka Rama Rao', 'Taraka Rama Rao'],
  'Pawan Kalyan': ['Pawan', 'PK', 'Power Star', 'Pavan Kalyan', 'Pawan Kalyan Konidela'],
  'Nani': ['Natural Star', 'Naveen Babu Ghanta', 'Nani Ghanta'],
  'Nagarjuna Akkineni': ['Nagarjuna', 'Nag', 'King Nag', 'Akkineni Nagarjuna', 'Nagarjun'],
  'Ravi Teja': ['Raviteja', 'Mass Maharaja', 'Ravi Tej'],
  'Nandamuri Balakrishna': ['Balakrishna', 'Balayya', 'NBK', 'Bala Krishna', 'Nandamuri Bala Krishna', 'Bala Krishna Nandamuri'],
  'Rana Daggubati': ['Rana', 'Daggubati Rana', 'Rana Dagubati'],
  'Vijay Deverakonda': ['Vijay', 'VD', 'Rowdy Hero', 'Vijay Devarakonda', 'Deverakonda', 'Devarakonda'],
  'Naga Chaitanya Akkineni': ['Naga Chaitanya', 'Chay', 'Chaitanya', 'Akkineni Naga Chaitanya', 'NC'],
  'Varun Tej': ['Varun', 'Varun Tej Konidela', 'Mega Prince'],
  'Sai Dharam Tej': ['Sai Tej', 'Dharam Tej', 'SDT', 'Sai Dharam Teja', 'Sai Dharma Tej'],
  'Nithiin': ['Nithin', 'Nitin', 'Nithiin Reddy', 'Nitin Reddy'],
  'Sharwanand': ['Sharwa', 'Sharvanand', 'Sarwanand', 'Sharwanand Gandham'],
  'Adivi Sesh': ['Sesh', 'Adivi Seshu', 'Adavi Sesh', 'Adivi Shesh', 'Shesh'],
  'Nikhil Siddharth': ['Nikhil', 'Nikhil Siddhartha', 'Nikhil Sidharth'],
  'Sundeep Kishan': ['Sundeep', 'Sandeep Kishan', 'Sundeep Kishen', 'Sandeep Kishen'],
  'Chiranjeevi': ['Chiru', 'Megastar', 'Mega Star', 'Chiranjivi', 'Chiranjeevi Konidela', 'Siva Sankara Vara Prasad'],
  'Venkatesh Daggubati': ['Venkatesh', 'Venky', 'Victory Venkatesh', 'Daggubati Venkatesh', 'Venkatesh Dagubati'],
  'Akhil Akkineni': ['Akhil', 'Akkineni Akhil', 'Akhil Akineni'],
  'Nandamuri Kalyan Ram': ['Kalyan Ram', 'NKR', 'Nandamuri Kalyanram', 'Kalyanram'],
  'Siddharth': ['Siddarth', 'Siddhartha', 'Siddharth Suryanarayan', 'Sidharth'],
  'Gopichand': ['Gopi Chand', 'Macho Star', 'Gopichand Tottempudi'],
  'Vishwak Sen': ['Vishwaksen', 'Vishwak Sena', 'Vishvak Sen', 'Vishwak Sen Naidu'],
  'Sunil': ['Sunil Varma', 'Comedian Sunil', 'Sunil Hero'],
  'Vishnu Manchu': ['Vishnu', 'Manchu Vishnu', 'Vishnu Manchu Babu'],
  'Aadi': ['Adi', 'Aadi Saikumar', 'Adi Saikumar', 'Aadi Sai Kumar'],

  'Samantha Ruth Prabhu': ['Samantha', 'Sam', 'Samantha Akkineni', 'Samantha Prabhu', 'Samanta', 'Samantha Ruth'],
  'Anushka Shetty': ['Anushka', 'Sweety', 'Anushka Shetty Telugu', 'Anushka Setty', 'Anushka Sheety'],
  'Kajal Aggarwal': ['Kajal', 'Kajal Agarwal', 'Kajal Agrawal', 'Kajol Aggarwal', 'Kajal Aggerwal'],
  'Keerthy Suresh': ['Keerthy', 'Keerthi Suresh', 'Kirthi Suresh', 'Keerthi', 'Kirthy Suresh'],
  'Rashmika Mandanna': ['Rashmika', 'Rashmika Mandana', 'Rashmika Madanna', 'National Crush'],
  'Pooja Hegde': ['Pooja', 'Puja Hegde', 'Pooja Hegdey', 'Pooja Hegde Telugu'],
  'Tamannaah Bhatia': ['Tamannaah', 'Tamanna', 'Tamannah', 'Tamanna Bhatia', 'Tamannaah Bhatiya', 'Milky Beauty'],
  'Sai Pallavi': ['Pallavi', 'Sai Pallavi Senthamarai', 'Saipallavi', 'Sai Pallavi Sen'],
  'Trisha Krishnan': ['Trisha', 'Thrisha', 'Trisha Krishna', 'Trishna Krishnan'],
  'Nayanthara': ['Nayan', 'Nayantara', 'Nayanatara', 'Nayanthara Telugu', 'Lady Superstar'],
  'Kiara Advani': ['Kiara', 'Kiara Advanii', 'Kiyara Advani', 'Kiara Adwani'],
  'Sreeleela': ['Sreeleela Telugu', 'Sree Leela', 'Sri Leela', 'Srileela', 'Sreelila', 'Leela'],
  'Raashi Khanna': ['Raashi', 'Rashi Khanna', 'Rashii Khanna', 'Raashii Khanna', 'Rashi'],
  'Rakul Preet Singh': ['Rakul', 'Rakul Preet', 'Rakul Singh', 'Rakulpreet Singh', 'Rakul Preet Sing'],
  'Nithya Menen': ['Nithya', 'Nitya Menen', 'Nithya Menon', 'Nitya Menon', 'Nithya Meneen'],
  'Mehreen Pirzada': ['Mehreen', 'Mehrene Pirzada', 'Mehreen Kaur Pirzada', 'Mehrin Pirzada', 'Mehreen Kaur'],
  'Anupama Parameswaran': ['Anupama', 'Anupama Parameshwaran', 'Anupama Parameswaran Telugu', 'Anupama Parmeswaran', 'Anu Parameswaran'],
  'Mrunal Thakur': ['Mrunal', 'Mrinal Thakur', 'Mrunal Takur', 'Mrunal Thakoor', 'Mrinal Thakoor'],
  'Nabha Natesh': ['Nabha', 'Nabha Natesh Telugu', 'Nabha Natessh', 'Nabha Nateesh'],
  'Shriya Saran': ['Shriya', 'Shreya Saran', 'Sriya Saran', 'Shriya Sharan', 'Shreya Sharan'],
  'Shruti Haasan': ['Shruti', 'Shruti Hassan', 'Shruthi Haasan', 'Shruthi Hassan', 'Sruthi Haasan'],
  'Nivetha Thomas': ['Nivetha', 'Nivedha Thomas', 'Niveta Thomas', 'Nivetha Thomas Telugu'],
  'Nidhhi Agerwal': ['Nidhhi', 'Nidhi Agerwal', 'Nidhi Agarwal', 'Nidhhi Agarwal', 'Nidhi Aggarwal'],
  'Krithi Shetty': ['Krithi', 'Kriti Shetty', 'Kirthi Shetty', 'Krithi Setty', 'Kruthi Shetty'],
  'Aishwarya Rajesh': ['Aishwarya', 'Aishwarya Rajesh Telugu', 'Aishwaria Rajesh', 'Aiswarya Rajesh', 'Aishwarya Rajeesh'],
  'Anu Emmanuel': ['Anu', 'Anu Emanuel', 'Anu Emmanual', 'Anu Immanuel', 'Anu Emmanuel Telugu'],
  'Regena Cassandrra': ['Regena', 'Regina Cassandra', 'Regina', 'Regena Cassandra', 'Regina Cassandrra'],
  'Lavanya Tripathi': ['Lavanya', 'Lavanya Tripati', 'Lavanya Tripathy', 'Lavanya Tripathi Telugu', 'Lavanya Tripthi'],
  'Samyuktha Menon': ['Samyuktha', 'Samyuktha Menon Telugu', 'Samyukta Menon', 'Samyuktha Menen', 'Samyuktha Menan'],
};

// Words too common to identify anyone on their own.
const generic = new Set(['babu', 'kumar', 'rao', 'reddy', 'naidu', 'raju', 'star', 'sri', 'the', 'mr', 'ms', 'telugu', 'hero', 'actor', 'actress', 'film', 'movie', 'kaur', 'preet']);

// A rough sound-alike spelling, so Telugu spelling variants (th/t, w/v, ee/i, double letters) agree.
export function key(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/w/g, 'v').replace(/ph/g, 'f').replace(/z/g, 'j')
    .replace(/h/g, '').replace(/y/g, 'i').replace(/q/g, 'k')
    .replace(/(.)\1+/g, '$1')
    .replace(/ee/g, 'i').replace(/oo/g, 'u');
}

function distance(a, b) {
  if (a === b) return 0;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}
// How many slips are allowed against a name this long.
const slack = length => (length <= 3 ? 0 : length <= 6 ? 1 : length <= 9 ? 2 : 3);

const words = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// How well the guess fits one person: smaller is better, null means not at all.
function fit(guess, person, extra = {}) {
  const forms = [person.name, ...(nameAliases[person.name] ?? []), ...(extra[person.name] ?? [])];
  const g = key(guess);
  if (!g) return null;
  let best = null;
  const take = value => { if (best === null || value < best) best = value; };
  for (const form of forms) {
    const f = key(form);
    const d = distance(g, f);
    if (d <= slack(f.length)) take(d);
    // A long enough start of a name, like "Prab" for Prabhas.
    if (g.length >= 4 && f.length > g.length && f.startsWith(g) && f.length - g.length <= 3) take(1);
  }
  // Every word typed matches some word of the name, like "Kalyan Ram" or "Arjun".
  const typed = words(guess).filter(word => word.length >= 3 && !generic.has(word));
  const parts = forms.flatMap(words).filter(word => word.length >= 3 && !generic.has(word)).map(key).filter(Boolean);
  if (typed.length) {
    let total = 0;
    const ok = typed.every(word => {
      const k = key(word);
      let hit = null;
      for (const part of parts) {
        const d = distance(k, part);
        if ((d <= slack(part.length) || (k.length >= 4 && part.startsWith(k) && part.length - k.length <= 3)) && (hit === null || d < hit)) hit = d;
      }
      if (hit === null) return false;
      total += hit;
      return true;
    });
    if (ok) take(total + 0.5);
  }
  return best;
}

// Is the guess the right person, judged against everyone in the same level?
export function guessIsCorrect(guess, answer, everyone, extra = {}) {
  const people = [...new Set([answer, ...everyone])].map(name => ({ name }));
  const scores = people.map(person => ({ name: person.name, score: fit(guess, person, extra) })).filter(item => item.score !== null);
  if (!scores.length) return false;
  const lowest = Math.min(...scores.map(item => item.score));
  const leaders = scores.filter(item => item.score === lowest);
  return leaders.length === 1 && leaders[0].name === answer;
}
