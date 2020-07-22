const Osdb = require('osudb');
const osu = require('node-osu');
const Discord = require('discord.js');
const client = new Discord.Client();
const {google} = require('googleapis');
const util = require('util');
const Settings = require('./settings');
require('date-utils');

const RANGE = 'music'; // TODO 可変にするかどうか迷う
let oAuth2Client = null;
let collections = [];

/* スプレッドシート処理 */
const authorize = (credentials, callback) => {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);  
    oAuth2Client.setCredentials(Settings.token);
    callback(oAuth2Client);
};
const getSheetData = async function(range){
    console.log('collections, loaded.');
    const sheets = google.sheets({version: "v4"});
    const param = {
        spreadsheetId: Settings.SPREADSHEET_ID,
        range: range,
        auth : oAuth2Client
    };

    const response = await sheets.spreadsheets.values.get(param);
    if(!response.data.values){return;}
    // TODO コレクション用だけじゃなくて、全データローカルに持ったほうが小回りが効く
    response.data.values.forEach((c,i) => {
        if (i === 0) {return;} // 1行目はスキップ
        if(!collections[c[0]]){
            collections[c[0]] = [];    
        }
        collections[c[0]].push(c[1]);
    });
}

const appendData = async function(lineArray){
    const sheets = google.sheets({version: "v4"});
    const param = {
        spreadsheetId: Settings.SPREADSHEET_ID,
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

const updateData = async function(lineArray, targetHash){
    const sheets = google.sheets({version: "v4"});
    collections.some((c,i) => {
        lineArray
    });
    let x = 1; // TODO targetHashを更新して云々 作ってない
    const param = {
        spreadsheetId: Settings.SPREADSHEET_ID,
        range: `RANGEB${x}`, 
        valueInputOption: "USER_ENTERED",
        auth : oAuth2Client,
        resource : {
            values : [lineArray]
        }
    };
    await sheets.spreadsheets.values.append(param);
};

/* osuApi */
const osuApi = new osu.Api(Settings.OSUAPIKEY, {
    notFoundAsError: true, 
    completeScores: false, 
    parseNumeric: false 
});

/* collection db 出力関数 */
const outputCollectionDB = (channel, options = {}) => {
    let prefix = options.prefix;
    let filename = options.filename || `collect_${new Date().toFormat("YYYYMMDDHH24MISS")}`;
    let outCollections = options.collections || collections; // イケてない
    let prefixedCollection = outCollections;
    const hasPrefix = prefix || String(prefix) === '0'; //prefixに0をつけたい稀有なオタクの対応
    if (hasPrefix) { //prefix対応
        prefixedCollection = [];
        Object.keys(outCollections).forEach((c) => {
            prefixedCollection[prefix+'_'+c] = outCollections[c];
        })    
    }
    // 書き込み対応 callbackでファイル送信
    Osdb.writeCollectionDB('./tmp.db', prefixedCollection, ()=>{
        channel.send({files: [{attachment: './tmp.db', name: `${filename}.db`}]});
    });
}  

/* Discord api */
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
})

client.on('message', async msg => {
    const urlregex = /^!add\s(https:\/\/osu\.ppy\.sh\/beatmapsets\/(\d+)\#osu\/(\d+))(\s.+)?/;
    if (urlregex.test(msg.content)) {
        console.log('is this beatmap url? '+msg.content);
        const url = msg.content.match(urlregex)[1];
        const mapsetid = msg.content.match(urlregex)[2];
        const mapid = msg.content.match(urlregex)[3];
        const ddurl = `https://osu.ppy.sh/d/${mapsetid}`;
        const comment = msg.content.match(urlregex)[4] && msg.content.match(urlregex)[4].trim() || '(no comment.)';
    
        // TODO 実質波動拳なので外出しするかも
        osuApi.getBeatmaps({ b: mapid }).then(beatmaps => {
            const title = `${beatmaps[0].title} [${beatmaps[0].version}]`.replace(/"/g,"\"\""); // 曲名サニタイズ
            const author = `${msg.author.username}#${msg.author.discriminator}`;
            const status = beatmaps[0].approvalStatus;
            const values = [author
                , beatmaps[0].hash
                , (new Date).toString() //date-utilsあるからformatしてもいい
                , `=HYPERLINK("${url}","${title}")`
                , Math.round(beatmaps[0].difficulty.rating * 100) / 100
                , `'${comment}` // 関数化対策にクオート挿入
                , mapid
                , mapsetid
                , status
                , `=HYPERLINK("${ddurl}","DOWNLOAD")`
            ];
            
            // 配列追加処理
            if(!collections[author]){
                collections[author] = [];
            };
            // 同値ならスキップ
            if(collections[author].some((hash) => beatmaps[0].hash === hash)){
                msg.channel.send('already added');
            } else {
                msg.channel.send(`author: ${author}\nmap hash: ${beatmaps[0].hash}`);
                collections[author].push(beatmaps[0].hash);
                appendData(values);
            }
        });
        return;
    }

    // DB出力
    const collectregex = /^!collect(\s-prefix(\s.+))?/;
    if (collectregex.test(msg.content)){
        const param = msg.content.match(collectregex)[2];
        const prefix = param === undefined ? '' : param.trim();
        // osdb(collection.db形式) 出力処理
        const options = {
            prefix: prefix
        };
        outputCollectionDB(msg.channel, options);
        return;
    }
    // matchDB出力
    const matchregex = /^!match\s(https:\/\/osu\.ppy\.sh\/community\/matches\/(\d+))?/;
    if (matchregex.test(msg.content)){
        const matchid = msg.content.match(matchregex)[2];
        osuApi.getMatch({ mp: matchid }).then(match => {
            if(!match){return;}
            let matchDB = [];
            let collectionName = `ZZ ${match.raw_start}: ${match.name} (${matchid})`;
            matchDB[collectionName] = []
            const stack = [];
            match.games.forEach((c)=>{
                stack.push(osuApi.getBeatmaps({ b: c.beatmapId }));
            })
            Promise.all(stack).then((bmArray)=> {
                bmArray.forEach((beatmaps)=>{
                    if(!beatmaps){return;} // Not Uploaded対応 そんな譜面をプレイするな
                    matchDB[collectionName].push(beatmaps[0].hash);
                });
                const options = {
                    collections: matchDB,
                    filename: `match_${matchid}_${new Date().toFormat("YYYYMMDDHH24MISS")}`
                };
                outputCollectionDB(msg.channel, options);
            });
        });
        return;
    }
})

/** main処理 */
console.log('Hello. (^o^)/');
authorize(Settings.credentials ,(oAuth2Client) => {
    console.log('googole api authed!');
    getSheetData(RANGE);
    client.login(Settings.DISCORDTOKEN);
});

