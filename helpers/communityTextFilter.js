/**
 * Censor vulgar / adult language in community posts & chat.
 * Uses `bad-words` and replaces matches with *.
 */
const Filter = require("bad-words");

const filter = new Filter({ placeHolder: "*" });

// Extra adult / spam terms not always covered by the default list
filter.addWords(
  "porn",
  "porno",
  "pornography",
  "xxx",
  "nsfw",
  "onlyfans",
  "hentai",
  "nude",
  "nudes",
  "nudity",
  "camgirl",
  "sexcam",
  "blowjob",
  "handjob",
  "cumshot",
  "deepthroat",
  "dildo",
  "vibrator",
  "masturbate",
  "masturbation",
  "orgasm",
  "ejaculate",
  "ejaculation",
  "boobs",
  "tits",
  "pussy",
  "dick",
  "cock",
  "penis",
  "vagina",
  "anal",
  "fetish",
  "bdsm",
  "escort",
  "prostitue",
  "prostitute",
  "hooker",
  "slut",
  "whore",
  "milf",
  "dilf",
  "threesome",
  "gangbang",
  "creampie",
  "squirting",
  "stripper",
  "stripclub",
  "sexchat",
  "sext",
  "sexting",
  "horny",
  "rape",
  "rapist",
);

/**
 * Replace vulgar / adult words with asterisks.
 * Safe for empty / non-string input.
 */
function cleanCommunityText(input) {
  const text = String(input ?? "");
  if (!text.trim()) return text;
  try {
    return filter.clean(text);
  } catch {
    // bad-words can throw on some unicode edge cases — keep original rather than fail send
    return text;
  }
}

module.exports = {
  cleanCommunityText,
};
