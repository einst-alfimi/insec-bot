const Osdb = require('osudb');
const osu = require('node-osu');
const Discord = require('discord.js');
const client = new Discord.Client();
const {google} = require('googleapis');
require('dotenv').config();

const token = {"access_token":process.env.ACCESS_TOKEN,
              "refresh_token":process.env.REFRESH_TOKEN,
              "scope":"https://www.googleapis.com/auth/spreadsheets",
              "token_type":"Bearer",
              "expiry_date":process.env.EXPIRY_DATE}

const RANGE = 'music'
const CREDS = {installed :{
    "client_id":process.env.CLIENT_ID,
    "project_id":process.env.PROJECT_ID,
    "auth_uri":"https://accounts.google.com/o/oauth2/auth",
    "token_uri":"https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs",
    "client_secret":process.env.CLIENT_SECRET,
    "redirect_uris":["urn:ietf:wg:oauth:2.0:oob","http://localhost"]
}}

console.log('Hell O');

let oAuth2Client = null;
let collections = {};

function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);  
      oAuth2Client.setCredentials(token);
      callback(oAuth2Client);
}
getSheetData = async function(){
    console.log('collections, loaded.');
    const sheets = google.sheets({version: "v4"});
    const param = {
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: RANGE,
        auth : oAuth2Client
    };

    let response = await sheets.spreadsheets.values.get(param);
    if(response.data.values){
        response.data.values.forEach((c) => {
            if(!collections[c[0]]){
                collections[c[0]] = [];    
            }
            collections[c[0]].push(c[1]);
        });
    }
}

authorize(CREDS ,(oAuth2Client) => {
    console.log('googole api authed!');
    getSheetData();
    client.login(process.env.DISCORDTOKEN);
});

const osuApi = new osu.Api(process.env.OSUAPIKEY, {
    notFoundAsError: true, 
    completeScores: false, 
    parseNumeric: false 
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
})

client.on('message', async msg => {
  // ex https://osu.ppy.sh/beatmapsets/805762#osu/1691360
  const urlregex = /^!add\s(https:\/\/osu\.ppy\.sh\/beatmapsets\/(\d+)\#osu\/(\d+))(\s.+)?/;
  if (urlregex.test(msg.content)) {
    console.log('is this beatmap url? '+msg.content);
    const url = msg.content.match(urlregex)[1];
    const mapid = msg.content.match(urlregex)[3];
    const comment = msg.content.match(urlregex)[4] ? msg.content.match(urlregex)[4].trim() : 'no comment.';
    
    osuApi.getBeatmaps({ b: mapid }).then(beatmaps => {
        const title = `${beatmaps[0].title} [${beatmaps[0].version}]`;
        const titleCell = {"userEnteredValue": {
                "formulaValue": `=HYPERLINK(${url},${title})`
            }};
        const author = `${msg.author.username}#${msg.author.discriminator}`;
        // 追加処理
        if(!collections[author]){
            collections[author] = [];
        };
        // 同値ならスキップ
        if(collections[author].some((hash) => beatmaps[0].hash === hash)){
            msg.channel.send('already added');
        } else {
            msg.channel.send(`author: ${author}`+'\n'
            + `map hash: ${beatmaps[0].hash}`);
            collections[author].push(beatmaps[0].hash);
            appendData = async function(){
                const sheets = google.sheets({version: "v4"});
                const param = {
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: RANGE, 
                    valueInputOption: "USER_ENTERED",
                    insertDataOption : "INSERT_ROWS",
                    auth : oAuth2Client,
                    resource : {
                        values : [[author, beatmaps[0].hash, (new Date).toString(),
                        `=HYPERLINK("${url}","${title}")`, Math.round(beatmaps[0].difficulty.rating * 100) / 100, comment]]
                    }
                };
                await sheets.spreadsheets.values.append(param);
            };
            appendData();
        }
        console.log(collections); 
    });
  }

  if (msg.content === '!collect') {
      Osdb.writeCollectionDB('./tmp.db', collections, ()=>{
        msg.channel.send({
            files: [{
              attachment: './tmp.db',
              name: 'collect.db'
            }]
          });
      });
  }
})




