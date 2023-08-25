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
const relays = [damus]

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
	
		const kind = 30315;
		const expiration = Math.floor((new Date().getTime() + (update_rate*2)) / 1000)
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
		console.log(`playing ${mostRecent.name} - ${mostRecent.artist['#text']}`)

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


