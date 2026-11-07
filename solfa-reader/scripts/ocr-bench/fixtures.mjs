// Ground-truth fixtures for the OCR benchmark (.solfa text, SOLFA_FORMAT.md).
// All music here is original (written for the benchmark) except the format example.

export const FIXTURES = [
  {
    id: 'format-example',
    note: 'SOLFA_FORMAT.md §1 example, 4 voices, lyrics under system 1',
    text: `title: Hira fiderana (example)
key: G
time: 4/4
tempo: 84

S: | m  :m  :f  :s  | s  :f  :m  :r  |
A: | d  :d  :d  :t, | d  :r  :d  :t, |
T: | s  :s  :l  :s  | s  :l  :s  :s  |
B: | d  :d  :f, :s, | m, :r, :d, :s, |
W: Ry To-mpo ô, de-ra-in-ay i-an-ao

S: | d' :t  :l  :s  | s  :-  :-  :-  ||
A: | m  :r  :d  :d  | t, :-  :-  :-  ||
T: | s  :s  :f  :m  | r  :-  :-  :-  ||
B: | d  :s, :l, :d  | s, :-  :-  :-  ||
`,
  },
  {
    id: 'pickup-dotted',
    note: '3/4 in F, one-beat pick-up, dotted rhythms, lyrics under each system',
    text: `title: Fiderana
key: F
time: 3/4

S: :s, | d  :-.r :m  | s  :f  :m  | r  :-  :d  |
A: :s, | s, :-.t,:d  | m  :r  :d  | t, :-  :d  |
T: :m  | m  :-.f :s  | d' :t  :s  | s  :-  :m  |
B: :d  | d  :-   :d  | d  :r  :d  | s, :-  :d  |
W: O ry Tom-po, ho-de-ra-in-ay

S: | m  :-.f :s  | l  :s  :f  | m  :-  :r  | d  :-  ||
A: | d  :-.r :m  | f  :m  :r  | d  :-  :t, | d  :-  ||
T: | s  :-   :s  | d' :d' :l  | s  :-  :f  | m  :-  ||
B: | d  :-.t,:d  | f, :s, :l, | s, :-  :s, | d, :-  ||
W: ny fi-tia-nao ma-ha-ga-ga
`,
  },
  {
    id: 'chromatic-octaves',
    note: '4/4 in D, chromatics (fe se ta), octave marks (d\' r\' s,,), quarter and dotted divisions',
    text: `title: Hira vaovao
key: D
time: 4/4

S: | s  :fe  :s    :l   | t   :d'.r' :d'  :-   |
A: | m  :r   :m    :fe  | s   :s     :s   :-   |
T: | d' :l   :d'   :d'  | r'  :m'.f' :m'  :-   |
B: | d  :r   :d    :r   | s,  :m,.f, :s,  :-   |

S: | m  :se  :l    :ta  | l   :s,l.t :d'  :-   ||
A: | d  :t,  :d    :r   | d   :d     :d   :-   ||
T: | s  :m   :f    :f   | f   :m.,r  :m   :-   ||
B: | d  :m,  :f,   :s,  | f,  :s,,   :d,  :-   ||
`,
  },
  {
    id: 'three-voices',
    note: '2/4 in C, three voices (S A B) with printed labels, lyrics between S and A',
    labels: true,
    text: `title: Feo telo
key: C
time: 2/4
voices: S A B

S: | d  :m  | s  :-  | l  :s  | m  :-  |
W: Ma-sa-ka ny voa-ny
A: | d  :d  | t, :-  | d  :t, | d  :-  |
B: | d  :d  | s, :-  | f, :s, | d  :-  |

S: | f  :l  | s  :m  | r.m:f  | m  :-  ||
W: ary ma-mi-ra-pi-ra-py
A: | d  :d  | d  :d  | t, :t, | d  :-  ||
B: | f, :f, | m, :d, | s, :s, | d, :-  ||
`,
  },
];
