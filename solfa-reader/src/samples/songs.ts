/**
 * Built-in sample songs: ORIGINAL compositions written for Solfa Reader (no copyrighted music).
 * Texts are in canonical form (`formatSolfa(text) === text`). Ranges follow SOLFA_FORMAT §6.
 */

/** Scale and arpeggio in unison for every voice, then sustained I–IV–V–I chords (key C). */
export const WARM_UP = `title: Fanazaram-peo (warm-up)
composer: Solfa Reader (original)
key: C
time: 4/4
tempo: 80

# 1. Scale up and down, every voice together (T and B sound an octave lower)
S: | d :r :m :f | s :l :t :d' | d' :t :l :s | f :m :r :d |
A: | d :r :m :f | s :l :t :d' | d' :t :l :s | f :m :r :d |
T: | d :r :m :f | s :l :t :d' | d' :t :l :s | f :m :r :d |
B: | d :r :m :f | s :l :t :d' | d' :t :l :s | f :m :r :d |
W: do re mi fa sol la si do, do si la sol fa mi re do

# 2. Arpeggio
S: | d :m :s :d' | s :m :d :- |
A: | d :m :s :d' | s :m :d :- |
T: | d :m :s :d' | s :m :d :- |
B: | d :m :s :d' | s :m :d :- |
W: do mi sol do, sol mi do

# 3. Hold each chord and listen to the other voices
S: | m :- :- :- | f  :- :- :- | r  :- :- :- | m :- :- :- ||
A: | d :- :- :- | d  :- :- :- | t, :- :- :- | d :- :- :- ||
T: | s :- :- :- | l  :- :- :- | s  :- :- :- | s :- :- :- ||
B: | d :- :- :- | f, :- :- :- | s, :- :- :- | d :- :- :- ||
W: a, a, a, a
`;

/** Eight-bar SATB chorale in G, 4/4, two phrases (half cadence, then perfect cadence). */
export const CHORALE_G = `title: Fiadanana
composer: Solfa Reader (original)
key: G
time: 4/4
tempo: 72

S: | s  :m  :f  :s  | l  :s  :m  :- | f  :m  :r  :d  | r  :- :- :- |
A: | s, :l, :l, :d  | d  :d  :d  :- | d  :d  :t, :l, | t, :- :- :- |
T: | m  :m  :d  :m  | f  :s  :s  :- | l  :s  :s  :m  | s  :- :- :- |
B: | d, :d, :f, :d, | f, :m, :d, :- | f, :d, :s, :l, | s, :- :- :- |
W: Fi-a-da-na-na sy fi-ti-a-va-na, o-me-o a-nay ry Tom-po ô

S: | s  :m  :f  :s  | d' :t  :l  :s  | m  :f  :r  :- | d  :- :- :- ||
A: | d  :d  :d  :r  | m  :r  :d  :d  | d  :l, :s, :- | m, :- :- :- ||
T: | s  :l  :l  :s  | s  :s  :m  :d  | d  :d  :t, :- | d  :- :- :- ||
B: | m, :l, :f, :t, | d  :s, :l, :m, | l, :f, :s, :- | d, :- :- :- ||
W: Hi-a-ra-mi-hi-ra i-za-hay, mi-sa-o-tra A-na-o
`;

/** Song in F, 3/4, with a one-beat pick-up and dotted rhythms (\`.,\`). */
export const WALTZ_F = `title: Hira maraina
composer: Solfa Reader (original)
key: F
time: 3/4
tempo: 96

S: :s, | d  :- :m  | s.,f :m  :r  | d  :r  :m  | r  :- :t, |
A: :m, | m, :- :l, | t,   :s, :s, | m, :s, :s, | s, :- :-  |
T: :d  | d  :- :d  | r    :d  :t, | d  :t, :d  | t, :- :r  |
B: :d, | d, :- :l, | s,   :d, :s, | d, :s, :d, | s, :- :-  |
W: Mi-fo-ha ny ta-ny, mi-po-sa-ka ny ma-so-an-dro

S: | d  :- :m  | s.,l :s  :d' | l.,s :f :r  | d  :- ||
A: | s, :- :l, | t,   :d  :-  | d    :- :t, | s, :- ||
T: | m  :- :d  | r    :m  :-  | f    :l :s  | m  :- ||
B: | d  :- :l, | s,   :d, :-  | f,   :- :s, | d  :- ||
W: Mi-hi-ra i-si-ka, mi-fa-ly ny fo
`;
