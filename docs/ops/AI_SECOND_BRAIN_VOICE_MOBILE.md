# AI Second Brain — Voice & Mobile Operator Addendum — Legendary Arena

> **Last updated:** 2026-09-04
>
> The **executable** addendum for the voice interface described on the ewiki page
> [AI Second Brain → Voice interface](../../wiki/ai-second-brain.md#voice-interface-speech-in-speech-out).
> That page owns the *design* — voice is a replaceable agent-layer surface, it
> touches no Locked row, and it is a **Preferred** / runbook addition, **not** a
> new `DECISIONS.md` entry. **This file owns the *how*:** the phone path, the
> spoken-answer contract, and the do-this-week-vs-after-the-box steps. Where the
> two disagree, the ewiki page + [D-24341](../ai/DECISIONS.md#d-24341) win on
> design; this addendum is prescriptive only about realizing it.
>
> **This is a plan, not a rehearsed procedure.** The platform is still
> `status: draft` — **there is no brain running yet, so you cannot talk to the
> real store from a phone this weekend.** Voice is a step *after* the corpus
> census and the first navigation slice in
> [`AI_SECOND_BRAIN_RUNBOOK.md`](AI_SECOND_BRAIN_RUNBOOK.md). What you *can* do now
> is lock the spoken contract (below) against a vendor stand-in, so the phone path
> drops in the moment the chat surface exists.
>
> **Companion docs:** [`AI_SECOND_BRAIN_RUNBOOK.md`](AI_SECOND_BRAIN_RUNBOOK.md)
> owns the build (provision, `docker-compose`, schema, ingestion, first skills,
> restore drill); this addendum only adds the voice/mobile leg on top of it.

---

## 0. The one-paragraph version

Voice does not touch a Locked row. Speech in and speech out are replaceable
agent-layer pieces, same as LiteLLM and Open WebUI. There is still no brain
running, so you cannot talk to the real store from a phone this weekend — but you
can **lock the spoken contract now** against a vendor stand-in and **wire the
phone path the moment the chat surface exists.**

---

## 1. What actually works on a phone

Browsers will not give the microphone to `http://192.168.x.x:3000`. That secure-
context gate is the whole mobile problem — reaching a desktop server from a phone
over a plain LAN IP gets no mic prompt and no error; it simply never records.

**Tailscale Serve** is the clean fix for a single-operator box: a private path, a
real cert, and no public listener.

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:8080
tailscale serve status
```

- Replace `8080` with the port Open WebUI actually listens on.
- On the phone: install the Tailscale app, sign in to the **same** account, open
  `https://<host>.<tailnet>.ts.net`, grant the mic, and **Add to Home Screen**.
- Confirm it still loads on **cellular with Wi-Fi off** — that proves the tailnet
  path, not the local LAN, is carrying it.

Cloudflare Tunnel + Access is the alternative if you want the same gate the ewiki
already uses. Either way, the point is HTTPS + a private path; a bare LAN IP will
not do.

**Put speech-to-text and text-to-speech on the server, not in the phone browser.**
Web-API STT on iOS is flaky, and in-browser Kokoro has OOM'd Android tabs. Backend
**Whisper + Piper** is the v1 default on an 8 GB CPU box. In Open WebUI: turn on
**Conversation Mode** and auto-playback in the user Audio settings — that gives
the loop you want (talk, answer, read back sentence-by-sentence as it streams, mic
re-arms).

---

## 2. Spoken vs citable — split the surfaces

The citation shape the knowledge-query surface returns cannot be read aloud, and
*Auditability* is not optional. Split the two surfaces:

- **Mouth:** two or three sentences, then a pointer — `from D-24341`.
- **Pane:** the full `source_path`, heading, and `content_hash`.

Enforce it with the **voice-mode system prompt** (Open WebUI voice mode carries
its own, separate from the chat prompts). This same prompt is the **stand-in
prompt** to paste into a vendor mobile voice mode this week:

```
You are speaking, not typing.

Answer in 2–3 short sentences. No lists, no markdown, no URLs, no file paths, no hashes.
If you used an authoritative source, end with a spoken pointer: "from D-24341" or "from Work Packet 594".
If you do not have an authoritative source, say so in one clause and stop. Do not invent a decision.
Never promote a guess to policy. Never read a citation block aloud.
The chat pane already shows the full source; your job is the car version.
```

Voice sessions land as **Transient** (ewiki
[Knowledge governance](../../wiki/ai-second-brain.md#knowledge-governance-how-knowledge-enters-moves-and-earns-authority)).
Nothing gets promoted to Authoritative without a keyboard.

---

## 3. Do this week vs after the box exists

**This week (against a stand-in surface).** Load `DECISIONS.md`, the ewiki page,
and the active Work Packet index into a Claude (or Grok) **Project**. Paste the
prompt above. Use the vendor mobile voice mode and **write down every answer that
was too long, unsourced, or invented.** That list is the improvement loop before
any real surface exists.

**When Open WebUI is up.** Put the same prompt in Admin → Interface → Voice Mode
Custom Prompt. Run local Whisper `base`/`small` + a Piper sidecar behind
`/v1/audio/speech`. The phone talks only to Open WebUI over Tailscale HTTPS.
Engineering and Barefoot Betters audio never leaves the host (keep STT **local**
for those domains — hosted STT ships raw, pre-retrieval dictation to a vendor).

**Pilot test worth running.** Ask a governance question from the phone. The spoken
answer is ≤3 sentences with a verbal pointer; the chat pane shows the real
citation. No vector layer required.

---

## 4. The three swappable legs

Each leg is a config choice, not code — both audio legs speak the same
OpenAI-compatible shape as the model calls, so they sit behind LiteLLM for the
same reason the endgame coach does (swap = config, not a code edit).

| Leg | Local (owned host) | Hosted (quality) |
|---|---|---|
| Speech → text | local Whisper in Open WebUI (`faster-whisper` `base`/`small`, CPU) | any OpenAI-compatible transcription API |
| Reasoning | the LiteLLM roster | same |
| Text → speech | Piper or Kokoro behind an OpenAI-shaped endpoint | any OpenAI-compatible `/audio/speech` endpoint |

**CPU caveat.** `faster-whisper` `base`/`small` on an 8 GB / 2 vCPU box is fine
for 5–15-second turns and degrades badly on a two-minute ramble. Measure before
committing the local-vs-hosted STT row.

---

## 5. Suggested Preferred rows (no new DECISIONS entry)

These mirror the ewiki page's Preferred table — recorded here so the operator
build has them in one place. Still **Preferred**, still swappable, still no
`DECISIONS.md` entry:

- Mobile voice = Open WebUI conversation mode over Tailscale Serve HTTPS.
- Default audio legs = local Whisper + Piper.
- Spoken answer short with a verbal pointer; full citations in the pane.
- Hosted STT/TTS only after local accuracy fails, and never for sensitive domains.

---

## References

- [AI Second Brain → Voice interface](../../wiki/ai-second-brain.md#voice-interface-speech-in-speech-out)
  — the design record this addendum realizes.
- [`AI_SECOND_BRAIN_RUNBOOK.md`](AI_SECOND_BRAIN_RUNBOOK.md) — the build runbook
  this voice leg sits on top of.
- [`DECISIONS.md` D-24341](../ai/DECISIONS.md#d-24341) — the locked architecture;
  voice changes none of it.
