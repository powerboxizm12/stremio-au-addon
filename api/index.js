const { addonBuilder, getInterface } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const REGIONS = ["Sydney", "Melbourne", "Brisbane", "Adelaide", "Perth", "Canberra", "Hobart", "Darwin"];
const FALLBACK_LOGOS = {
    "7": "https://i.imgur.com/8V5iJ2b.png", "7two": "https://i.imgur.com/5zD5z1s.png", "7mate": "https://i.imgur.com/DBCp2sM.png", "7flix": "https://i.imgur.com/A92i6S2.png",
    "9": "https://i.imgur.com/VlT00sL.png", "9Gem": "https://i.imgur.com/pZq1gG3.png", "9Go!": "https://i.imgur.com/zWJ4nEV.png", "9Life": "https://i.imgur.com/i9Xp295.png",
    "9Rush": "https://i.imgur.com/iF5aG5V.png", "10": "https://i.imgur.com/7lR5kDK.png", "10 Bold": "https://i.imgur.com/e0yJ1v4.png", "10 Peach": "https://i.imgur.com/yXbNp3A.png",
    "ABC TV": "https://i.imgur.com/3yZ6k8j.png", "SBS": "https://i.imgur.com/gO9aT3U.png",
};
function formatLogo(url) {
    if (!url) return null;
    const encodedUrl = encodeURIComponent(url);
    return `https://images.weserv.nl/?url=${encodedUrl}&bg=black&w=200&h=200&fit=contain`;
}
function simpleM3UParser(m3uText) {
    const lines = m3uText.trim().split('\n'), items = []; let currentItem = {};
    for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
            currentItem = {};
            const nameMatch = line.match(/,(.+)$/); if (nameMatch) currentItem.name = nameMatch[1].trim();
            const logoMatch = line.match(/tvg-logo="([^"]+)"/); if (logoMatch) currentItem.logo = logoMatch[1];
        } else if (line.startsWith('http') && currentItem.name) {
            currentItem.url = line.trim(); items.push(currentItem); currentItem = {};
        }
    } return items;
}
const manifest = {
    id: 'community.australia.tv.powerbox.web', version: '5.0.0', name: 'Australian TV by Powerbox (Web)',
    description: 'Publicly hosted add-on for Australian TV with region selection.', resources: ['catalog', 'stream'], types: ['tv'],
    catalogs: [{ type: 'tv', id: 'au-tv-catalog', name: 'Australian TV' }], behaviorHints: { configurable: true },
    config: [{ key: "region", type: "select", title: "Select Your Region", options: REGIONS, default: "Sydney" }], idPrefixes: ['au-tv-']
};
const builder = new addonBuilder(manifest);
const channelCache = {};
async function getChannels(region) {
    region = region || "Sydney";
    if (channelCache[region] && (Date.now() - channelCache[region].timestamp < 3600000)) { return channelCache[region].data; }
    const playlistUrl = `https://i.mjh.nz/au/${region}/raw-tv.m3u8`;
    try {
        const response = await fetch(playlistUrl); if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const playlistText = await response.text(); const parsedItems = simpleM3UParser(playlistText);
        channelCache[region] = { data: parsedItems, timestamp: Date.now() }; return parsedItems;
    } catch (error) { console.error(`Error for ${region}:`, error); return []; }
}
builder.defineCatalogHandler(async ({ config }) => {
    const region = config.region || manifest.config[0].default;
    const channels = await getChannels(region);
    return { metas: channels.map(channel => {
        const fallbackKey = Object.keys(FALLBACK_LOGOS).find(key => channel.name.includes(key));
        const originalLogo = channel.logo || (fallbackKey ? FALLBACK_LOGOS[fallbackKey] : null);
        return { id: `au-tv-${region}:${channel.name}`, type: 'tv', name: channel.name, poster: formatLogo(originalLogo), posterShape: 'square', description: `Region: ${region}` };
    }) };
});
builder.defineStreamHandler(async ({ id }) => {
    const idParts = id.replace('au-tv-', '').split(':'); const region = idParts[0]; const channelName = idParts[1];
    if (!region || !channelName) return { streams: [] };
    const channels = await getChannels(region);
    const requestedChannel = channels.find(ch => ch.name === channelName);
    if (requestedChannel) { return { streams: [{ title: `${region} Stream`, url: requestedChannel.url }] }; }
    return { streams: [] };
});
module.exports = getInterface(builder);
