require('dotenv').config(); // for local .env

class Settings {
    constructor(){
        this.isSatisfied(); // ENVにデータがあるか確認、なければ強制終了
        this.token = {"access_token":process.env.ACCESS_TOKEN,
        "refresh_token":process.env.REFRESH_TOKEN,
        "scope":"https://www.googleapis.com/auth/spreadsheets",
        "token_type":"Bearer",
        "expiry_date":process.env.EXPIRY_DATE};
        this.credentials = {installed :{
            "client_id":process.env.CLIENT_ID,
            "project_id":process.env.PROJECT_ID,
            "auth_uri":"https://accounts.google.com/o/oauth2/auth",
            "token_uri":"https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs",
            "client_secret":process.env.CLIENT_SECRET,
            "redirect_uris":["urn:ietf:wg:oauth:2.0:oob","http://localhost"]
        }};
        this.SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        this.DISCORDTOKEN = process.env.DISCORDTOKEN;
        this.OSUAPIKEY = process.env.OSUAPIKEY;
    }

    /**
     * envコケたら、processが死
     */
    isSatisfied(){
        if ( //spreadsheet 
            process.env.ACCESS_TOKEN === undefined ||
            process.env.REFRESH_TOKEN === undefined ||
            process.env.EXPIRY_DATE === undefined ||
            process.env.CLIENT_ID === undefined ||
            process.env.PROJECT_ID === undefined ||
            process.env.CLIENT_SECRET === undefined ||
            process.env.SPREADSHEET_ID === undefined 
        ) {
            console.error('env was missing : GoogleAPI...');
            process.exit(6);
        }
        if ( // discord token 
            process.env.DISCORDTOKEN === undefined
        ) {
            console.error('env was missing : Discord TOKEN...');
            process.exit(7);
        }
        if ( // osu api key 
            process.env.OSUAPIKEY === undefined
        ) {
            console.error('env was missing : Osu! API Key...');
            process.exit(8);
        }
    }
}

module.exports = new Settings();
