# Daily 5% video V2 acceptance

Only the latest paired-script format is eligible for new video production. Do not retrofit V1 or fall back to narration-only scripts.

Each scene must contain caption_cues with paired caption and speech, plus complete caption_text and speech_text. Joining the cues must reproduce both texts exactly. The first scene must retain the immutable TAIWAN STOCK brand opening. Display and speech must convey identical facts in the same order.

Caption numbers use Arabic numerals for ticker codes, percentages, prices, volumes, dates and financial figures (6672, 9.9%, 555 元, 7,803 張, 10/8). Speech uses natural Mandarin (六六七二、百分之九點九、五百五十五元、七千八百零三張、十月八日). Ambiguous conversions fail closed, never guessed.

Every punctuation mark and space counts toward rendered line width. Verify the final font, font size, frame and safe margins; a 30-character count alone is insufficient. Preserve all text and use natural punctuation boundaries without splitting numeric tokens. Align speech cues using actual Edge TTS WordBoundary and measured render offsets. Any text loss, numerical mismatch, overflow or timing mismatch blocks acceptance.

First generate a fresh 20261008 V2 script, then run isolated edge-tts 7.3.1 YunJhe +15% through complete MP4 and SRT CI. Record Run ID, logs, MP4/SRT SHA and Artifact. Only after audiovisual review regenerate the other October trading dates. No main, production, cron, Pages, YouTube, publication-lock or Prompt B changes.
