const nostr = require('nostr')

const {RelayPool} = nostr
const privkey = process.env.NOSTR_PRIVKEY
const lastfmuser = process.env.LASTFM_USER
const lastfmapikey = process.env.LASTFM_APIKEY

if (!privkey) throw new Error("expected NOSTR_PRIVKEY env")
if (!lastfmuser) throw new Error("expected LASTFM_USER env")
if (!lastfmapikey) throw new Error("expected LASTFM_APIKEY env")

const pubkey = nostr.getPublicKey(privkey)
const damus = "wss://relay.damus.io"
const nos = "wss://nos.lol"
const eden = "wss://eden.nostr.land"
const relays = [damus, nos, eden]

const pool = RelayPool(relays)

const update_rate = 20000

var last_playing
async function fetch_playing() 
{
	try {
		console.log("fetching now playing status...")
		const req = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=1&user=${lastfmuser}&api_key=${lastfmapikey}&format=json`)
		const res = await req.json();
		const mostRecent = res.recenttracks.track[0]
		if (mostRecent['@attr'] && mostRecent['@attr'].nowplaying !== 'true') {
		    console.log('not playing')
		    return
		}

		const content = `${mostRecent.name} - ${mostRecent.artist['#text']}`
		if (last_playing === content) {
			console.log(`still playing '${content}'`)
			return
		}
		last_playing = content
	
		const kind = 30315;
		const expiration = Math.floor((new Date().getTime() + 60000*5) / 1000)
		const created_at = Math.floor(new Date().getTime() / 1000)
		const tags = [
			['d', 'music'],
			['expiration', `${expiration}`],
			['r', 'spotify:search:' + encodeURIComponent(`${mostRecent.name} ${mostRecent.artist['#text']}`)]
		]
		const songEv = {kind, content, tags, pubkey, created_at}
		songEv.id = await nostr.calculateId(songEv)
		songEv.sig = await nostr.signId(privkey, songEv.id)
		// get current time, add 30 seconds, and convert it to UNIX timestamp
		console.log(`sending ${mostRecent.name} - ${mostRecent.artist['#text']}`)
		console.log(songEv)

		pool.send(["EVENT", songEv])
	} catch (e) {
		console.error(e)
	}
}

var interval
pool.on('open', relay => {
	console.log("got open")

	if (interval)
		clearInterval(interval)
	else
		fetch_playing()

	interval = setInterval(fetch_playing, update_rate)
});


