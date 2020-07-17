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
let collections = [];

/* スプレッドシート処理 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);  
      oAuth2Client.setCredentials(token);
      callback(oAuth2Client);
}
getSheetData = async function(range){
    console.log('collections, loaded.');
    const sheets = google.sheets({version: "v4"});
    const param = {
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: range,
        auth : oAuth2Client
    };

    let response = await sheets.spreadsheets.values.get(param);
    if(response.data.values){
        response.data.values.forEach((c,i) => {
            if (i == 0) {return;} // 1行目はスキップ
            if(!collections[c[0]]){
                collections[c[0]] = [];    
            }
            collections[c[0]].push(c[1]);
        });
    }
}

appendData = async function(lineArray){
    const sheets = google.sheets({version: "v4"});
    const param = {
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: RANGE, 
        valueInputOption: "USER_ENTERED",
        insertDataOption : "INSERT_ROWS",
        auth : oAuth2Client,
        resource : {
            values : [lineArray]
        }
    };
    await sheets.spreadsheets.values.append(param);
};

updateData = async function(lineArray, targetHash){
    const sheets = google.sheets({version: "v4"});
    collections.some((c,i) => {
        lineArray
    });
    let x = 1; // TODO targetHashを更新して云々
    const param = {
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `RANGEB${x}`, 
        valueInputOption: "USER_ENTERED",
        auth : oAuth2Client,
        resource : {
            values : [lineArray]
        }
    };
    await sheets.spreadsheets.values.append(param);
};

authorize(CREDS ,(oAuth2Client) => {
    console.log('googole api authed!');
    getSheetData(RANGE);
    client.login(process.env.DISCORDTOKEN);
});

/* osuApi */
const osuApi = new osu.Api(process.env.OSUAPIKEY, {
    notFoundAsError: true, 
    completeScores: false, 
    parseNumeric: false 
});
/* collection db 出力 */
outputCollectionDB = (msg, prefix) => {
    let prefixedCollection = [] //prefix対応
    collections.forEach((c,i) => {
        prefixedCollection[prefix+i] = c;
    })

    Osdb.writeCollectionDB('./tmp.db', prefixedCollection, ()=>{
        msg.channel.send({
            files: [{
              attachment: './tmp.db',
              name: 'collect.db'
            }]
          });
      });
}  

/* Discord api */
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
})

client.on('message', async msg => {
  // ex https://osu.ppy.sh/beatmapsets/805762#osu/1691360
  const urlregex = /^!add\s(https:\/\/osu\.ppy\.sh\/beatmapsets\/(\d+)\#osu\/(\d+))(\s.+)?/;
  if (urlregex.test(msg.content)) {
    console.log('is this beatmap url? '+msg.content);
    const url = msg.content.match(urlregex)[1];
    const mapsetid = msg.content.match(urlregex)[2];
    const mapid = msg.content.match(urlregex)[3];
    const ddurl = `https://osu.ppy.sh/d/${mapsetid}`;
    const comment = msg.content.match(urlregex)[4] ? msg.content.match(urlregex)[4].trim() : 'no comment.';
    
    osuApi.getBeatmaps({ b: mapid }).then(beatmaps => {
        const title = `${beatmaps[0].title} [${beatmaps[0].version}]`.replace(/"/g,"\"\""); // 曲名サニタイズ
        const author = `${msg.author.username}#${msg.author.discriminator}`;
        const values = [author
            , beatmaps[0].hash
            , (new Date).toString()
            , `=HYPERLINK("${url}","${title}")`
            , Math.round(beatmaps[0].difficulty.rating * 100) / 100
            , `'${comment}` // 関数化対策
            , mapid
            , mapsetid
            , `=HYPERLINK("${ddurl}","DOWNLOAD")`
        ]
        
        // 配列追加処理
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
            
            appendData(values);
        }
        console.log(collections); 
    });
  }

  const collectregex = /^!collect(\s-prefix(\s.+))?/;
  if (collectregex.test(msg.content)){
        const pram = msg.content.match(collectregex)[2];
        const prefix = pram ? pram.trim() : '';

      // osdb(collection.db形式) 出力処理
      outputCollectionDB(msg, prefix);
  }
})




