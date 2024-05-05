const dotenv = require('dotenv')
dotenv.config()
const { Telegraf, Input } = require('telegraf')
const bot = new Telegraf(process.env.TOKEN);
const seconds_per_day = 1000 * 60 * 60 * 24;
const fse = require("fs")
const models = require('./dbactions')
var WatchJS = require("melanke-watchjs")
var watch = WatchJS.watch;
const knex = require('knex')({
    client: 'better-sqlite3',
    useNullAsDefault: true,
    connection: {
        filename: './data.db',
    },
});



//   function getLeftJoin(table,left,right){
//     return `LEFT OUTER JOIN ${table} on ${left} = ${right}`
//   }
const User = new models.userModel({
    tableName: 'users',
    connection: knex,
    idAttribute: 'userid',
    columns: [
        'users.*',
    ]
});
const File = new models.fileModel({
    tableName: 'files',
    connection: knex,
});
const fileConnection = new models.fileModel({
    tableName: 'groupbuyFileconnection',
    connection: knex,
    columns: [
        'groupbuyFileconnection.*',
        'files.*'
    ],
    joins: [
        { table: 'files', first: 'files.id', second: 'groupbuyFileconnection.fileid' },
    ]
});
const userConnection = new models.fileModel({
    tableName: 'groupbuyUserConnection',
    connection: knex,
    columns: [
        'groupbuyUserConnection.*',
        'users.*'
    ],
    joins: [
        { table: 'users', first: 'users.userid', second: 'groupbuyUserConnection.userid' },
    ]
});

const Groupbuy = new models.groupModel({
    tableName: 'groupbuys',
    connection: knex,
    columns: [
        'groupbuys.*'
    ],
    // joins: [
    //     { table: 'groupbuyFileconnection', first: 'groupbuys.id', second: 'groupbuyFileconnection.groupid' },
    //     { table: 'files', first: 'groupbuyFileconnection.fileid', second: 'files.id' }
    // ]
});
// const User = new BookModel(opts);

Date.prototype.yyyymmdd = function () {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();
    var hh = this.getUTCHours()

    return [this.getFullYear(),
    (mm > 9 ? '' : '0') + mm,
    (dd > 9 ? '' : '0') + dd
    ].join('-') + (hh > 9 ? '' : '0') + " " + hh + " UTC";
};
function isadmin(ctx) {
    if (ctx.groupbuy && ctx.update.message.from.id != ctx.groupbuy.admin) {
        return false;
    }
    return true;
}
async function isHelper(ctx) {
    let helpers=await userConnection.find({groupid:ctx.groupid,helper:true,userid:ctx.from.id+""});
    return helpers.length>0
}

function hasGroupbuy(ctx) {
    return (ctx.groupbuy)
}
function hasTopics(ctx) {
    if (ctx.update && ctx.chat.is_forum && ctx.message && ctx.message.is_topic_message) {
        return ctx.message.message_thread_id;
    }
    return false;
}

function getSessionKey(ctx) {
        
    if(ctx.updateType==='callback_query'){
        
        let data=ctx.callbackQuery.data.split(" ")
        if(data.length>1){
            return `${ctx.chat.id+""}:${data[1].replace('topic|','')}`
        }
        else{
            return `${ctx.chat.id+""}`
        }
    }
    if(hasTopics(ctx) ){
        return `${ctx.chat.id+""}:${ctx.message.message_thread_id}`
    }
    else if (ctx.chat) {
        return `${ctx.chat.id+""}`
    } else {
        return `${ctx.from.id+""}`
    }

}
async function addGroupbuyInfo(ctx){
    let groupbuy =await Groupbuy.getActiveGroupbuy(getSessionKey(ctx))
    // let session = await store.get(`${ctx.chat.id+""}`)
    
    // session = session ? (typeof session === 'object' ? session : JSON.parse(session)) : {};
    watch(groupbuy, () => {
        setTimeout(() => {
            Groupbuy.update(groupbuy)
        }, 10);
        // store.set(`${ctx.chat.id+""}`,JSON.stringify(session))
    })
    ctx.groupbuy = groupbuy;
}
async function addUserInfo(ctx){
    let groupbuy = await User.find({userid:ctx.from.id+""})
    if(groupbuy.length<1){
        try{
            User.insert({
                username:ctx.from.username??ctx.from.first_name,
                userid:ctx.from.id+""
            })
        }catch(e){
        }
    }else{
        
    }
    watch(groupbuy, () => {
        setTimeout(() => {
            User.update(groupbuy)
        }, 10);
        // store.set(`${ctx.chat.id+""}`,JSON.stringify(session))
    })
    ctx.userModel = groupbuy;
}
bot.use(async function(ctx, next){
    if(ctx.chat.type=='private'){
        addUserInfo(ctx).then(()=>{
            next();
        });
    }
    else{
        addGroupbuyInfo(ctx).then(()=>{
            next();
        });
    }
}
);
// #TODO verify
bot.command('download', async ctx => {
    deleteMessage(ctx);
    if ((!isadmin(ctx) && !await isHelper(ctx) )||!hasGroupbuy(ctx)) {

        return;
    }
    let url = process.env.URL
    let filenames=[];
    let files= await fileConnection.find({groupid:ctx.groupbuy.id+""})
    ctx.groupbuy.download=true;
    if(!files || files.length<1){
        ctx.reply("There are no files added to this groupbuy yet")
        return;
    }
    files.forEach(x=>{
        filenames.push("\n"+x.name);
    })
    let topic=hasTopics(ctx)
    ctx.reply(`Click the below button to get the files your direct message\n
    Current list of files:`+filenames.join(''), {
        reply_markup: {
            inline_keyboard:
                [
                    [
                        { text: 'Get files', url: url + "getfiles_" + ctx.chat.id+(topic?"__"+topic:'') }
                    ]
                ]

        }
    })
})

// #TODO verify
bot.command(["start", "help"], async(ctx) => {
    if ( !ctx.message.text.includes("/help") &&  ctx.message.text != "/start") {
        let params = ctx.message.text.replace("/start ", "")
        if (params.includes("getfiles_")) {
            let chatid = params.replace("getfiles_", '').replace('__',":")
            let group= await Groupbuy.find({groupid:chatid});
            let buyer = await userConnection.find({groupid:group.id+"",userid:ctx.from.id+""})
            // let temp = ctx.sessionDB.get(`sessions`).getById(chatid).value();
            let found = false;

            if (buyer.length) {
                if (buyer[0].paid === true) {
                    ctx.reply("Sending over files from the groupbuy "+group.name)
                    let files = fileConnection.find({groupid:group.id+""})
                    files.forEach(file => {
                        if(file.fileid){
                            ctx.sendDocument(file.fileid)
                        }else{
                            ctx.telegram.forwardMessage(ctx.chat.id+"", file.chatid, file.message_id,{
                                protect_content:false
                            })
                        }
                        
                    })
                } else {
                    let name=group.name??""
                    bot.telegram.sendMessage(group.admin, "attempted claim of non payer in groupbuy "+name+" they are #"+(index+1)+"\n"+JSON.stringify(ctx.chat,null,2));
                    sendToAdmin("attempted claim of non payer in groupbuy "+name+" they are #"+(index+1)+"\n"+JSON.stringify(ctx.chat,null,2))
                    ctx.reply("You have not yet paid if you believe this to be a mistake contact the group buy host. you are #"+(index+1));
                }
            }else{
                ctx.reply("cant find ya in the groupbuy")
            }
        }

        return;
    }
    ctx.reply(`Group Buy Bot Documentation

Commands:

/groupbuy - Initiates the group buy and registers the user as the admin.
/setprice {price} - Sets the price for the group buy.
/setmin {price} - Set a minimum price for the group buy
/setmax {price} - Set a maximum price for the group buy
/setcurrency {usd, euro, cad} - Sets the display currency (for visual purposes only).
/setdescription {description} - Sets a detailed description for the group buy.
/setdays {days} - Sets the duration of the group buy in days. Once the deadline is reached, no further participants can join.
/setlink {link} - Sets the join link for the group buy.
/clear - Clears the current group buy, allowing for a new person or a new group buy to start.
/paid {usernumber} - Sets the payment status of a specific user to "paid."
/setallpaid - Sets the payment status of all users to "paid."
/notpaid {usernumber} - Sets the payment status of a specific user to "unpaid."
/setallnotpaid - Sets the payment status of all users to "unpaid."
/unpaid - Mentions all buyers who have yet to pay.
/remove {usernumber} - Removes a specific user from the buyer list.
/kickunpaid - Removes all members who have joined the group buy but have not paid.
/donate - Get a donation link to help keep the bot running and fund new functionalities.

Notes:
The /setcurrency command is for display purposes only and does not affect any other functionalities.
The /setdays command determines the duration of the group buy, and after the deadline, no new participants can join.
Use the /clear command to reset the group buy for a new cycle.
Ensure accurate use of user numbers when applying commands for individual users.

For advanced functionalities please read the full documentation on https://github.com/Sheep-inc/Groupbuybot (WIP)
For support or suggestions, leave them in the GitHub page or contact @SheepGod on Telegram
`)
})
bot.command(["updatename","setname"],ctx=>{
    deleteMessage(ctx);
    if(ctx.chat.is_forum && ctx.message.reply_to_message && ctx.message.reply_to_message.forum_topic_created){
        ctx.groupbuy.name=ctx.chat.title +" | "+ ctx.message.reply_to_message.forum_topic_created.name
    }
    // ctx.reply("New name set for the groupbuy")
})
// #TODO VERIFY
bot.command("groupbuy",async ctx => {
    ctx.getChat(ctx.message.chat.id).then(async data => {
        if (!data.has_visible_history) {
            ctx.reply("Make sure to enable viewing of history first");
            return
        }

        if (ctx.groupbuy && ctx.groupbuy.admin && ctx.update.message.from.id != ctx.groupbuy.admin) {
            ctx.reply("You cant start a group buy in here");
            return
        } else {
            ctx.reply("Backups are currently disabled, we appolagize for the inconvenience")
            // exportData(ctx)
        }
      
        let groupbuy={
            description:"",
            cost:0,
            currency:"$",
            admin:ctx.from.id+"",
            name:ctx.chat.title,
            groupid:getSessionKey(ctx)
        }
        if(ctx.chat.is_forum && ctx.message.reply_to_message && ctx.message.reply_to_message.forum_topic_created){
            groupbuy.name=ctx.chat.title +" | "+ ctx.message.reply_to_message.forum_topic_created.name
        }
       
        let username = ctx.message.from.username
        if(topic=hasTopics(ctx)){
            groupbuy.topic=topic+""
        }
        ctx.groupbuy= await Groupbuy.insert(groupbuy)
        
        if (!username) {
            username = ctx.message.from.first_name;
        }
        let buyer = { username: username, userid: ctx.message.from.id+"",paid:false }
        sendToAdmin('new Groupbuy created by\n'+JSON.stringify(buyer,null,2))
        
        // use this to update users at all times when interacting with the bot
        await User.upsert({username:buyer.username,userid:buyer.userid+""})
        await userConnection.insert({userid:buyer.userid+"",groupid:ctx.groupbuy.id+""})
        
        buildMessage(ctx).then(msg=>{
            ctx.reply(msg, {
                reply_markup: {
                    inline_keyboard: [[{ text: "add me", callback_data: addCallback(ctx) }]]
                }
            }).then(msg => {
                ctx.groupbuy.message = msg.message_id+""
                Groupbuy.update({id:ctx.groupbuy.id+"",message:msg.message_id+""})
            });
        })
        
    })
});
async function buildMessage(ctx) {
    let buyers =await userConnection.find({groupid:ctx.groupbuy.id+""});
    console.log(buyers)
    let datestring = "";
    if (ctx.groupbuy.date) {
        datestring = "Deadline: " + new Date(ctx.groupbuy.date).yyyymmdd() + "\r\n\r\n"
    }
    let linkString = "";
    if (ctx.groupbuy.link) {
        linkString = "Link: " + ctx.groupbuy.link + "\r\n\r\n"
    }
    let price = ctx.groupbuy.cost
    if (buyers) {
        price = Math.ceil(buyers.length > 1 ? ctx.groupbuy.cost / buyers.length * 100 : ctx.groupbuy.cost * 100) / 100;
    }

    if(price>ctx.groupbuy.maxPrice && ctx.groupbuy.maxPrice>0){
        price=ctx.groupbuy.maxPrice
    }
    
    if(price<ctx.groupbuy.minPrice && ctx.groupbuy.minPrice>0){
        price=ctx.groupbuy.minPrice
    }

    let message = "New group buy started \r\n" +
        "Description:\r\n" +
        ctx.groupbuy.description +
        (ctx.groupbuy.maxPrice>0?"\r\nmax-price: "+ctx.groupbuy.currency+ctx.groupbuy.maxPrice:"")+
        (ctx.groupbuy.minPrice>0?"\r\nmin-price: "+ctx.groupbuy.currency+ctx.groupbuy.minPrice:"")+
        "\r\n\r\ncost:\r\n" +
        "\r\n"+ ctx.groupbuy.currency + ctx.groupbuy.cost + "\r\n \r\n" +
        "\r\ncurrent price:\r\n" +
        ctx.groupbuy.currency + price + "\r\n\r\n" +
        linkString +
        datestring +
        "Buyers list:\r\n"
        ;
        if(buyers.length>0){
            buyers.forEach((buyer, i) => {
                message += (i + 1) + ": " + buyer.username + (buyer.paid ? " : paid" : " : unpaid") + "\r\n"
            });
        }
    return message;
}
// #TODO verify
bot.command("setprice", ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx) ||!hasGroupbuy(ctx)) {
        return;
    }
    let price = ctx.update.message.text.replace("/setprice ", "")
    if (!Number(price)) {
        ctx.reply("This is not a number try again " + price)
        return;

    }
    if (ctx.groupbuy.cost == price) {
        ctx.reply("You are setting the price to the same value it already is")
        return;
    }
    ctx.groupbuy.cost = price;

    ctx.reply("updated message")
    updateMessage(ctx)

});
// #TODO verify
bot.command("setdescription", ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx) ||!hasGroupbuy(ctx)) {

        return;
    }
    let description = ctx.update.message.text.replace("/setdescription ","").replace("/setdescription", "")

    ctx.groupbuy.description = description;

    ctx.reply("updated message")
    updateMessage(ctx)

});
// #TODO verify
bot.command("setlink",async ctx => {
    deleteMessage(ctx)
    if ((!isadmin(ctx) && !await isHelper(ctx) )||!hasGroupbuy(ctx)) {

        return;
    }
    let link = ctx.update.message.text.replace("/setlink ", "")

    ctx.groupbuy.link = link;

    ctx.reply("updated message")
    updateMessage(ctx)

});
// #TODO verify
bot.command("setcurrency", ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx) ||!hasGroupbuy(ctx)) {

        return;
    }
    let currency = ctx.update.message.text.replace("/setcurrency ", "")

    ctx.groupbuy.currency = currency;

    ctx.reply("updated message")
    updateMessage(ctx)

});
// #TODO verify
bot.command("paid", async ctx => {
    deleteMessage(ctx);
    if (!isadmin(ctx) && !await isHelper(ctx)) {
        ctx.reply("You dont have the power to command me")
        return;
    }else{
        
    }
    let index = ctx.update.message.text.replace("/paid ", "")
    let buyers = await userConnection.find({ groupid :ctx.groupbuy.id+""})
    if (buyers[Number(index - 1)]) {
        buyers[Number(index - 1)].paid = true;
        let buyer=buyers[Number(index - 1)]
        userConnection.update({id:buyer.id+"",paid:true})
        ctx.reply("updated message #" + index +"  ["+buyer.username+"](tg://users?id="+buyer.userid+") updated to paid",{
            parse_mode:'markdown'
        })
        //users.push(`[${x.username}](tg://user?id=${x.userid})`)
        updateMessage(ctx)
    } else {
        ctx.reply("Number not found");
    }
});
bot.command("notpaid", async ctx => {
    deleteMessage(ctx);
    if (!isadmin(ctx) && !await isHelper(ctx)) {
        ctx.reply("You dont have the power to command me")
        return;
    }else{
        
    }
    let index = ctx.update.message.text.replace("/notpaid ", "")
    let buyers = await userConnection.find({ groupid :ctx.groupbuy.id+""})
    if (buyers[Number(index - 1)]) {
        buyers[Number(index - 1)].paid = false;
        let buyer=buyers[Number(index - 1)]
        userConnection.update({id:buyer.id+"",paid:true})
        ctx.reply("updated message #" + index +"  ["+buyer.username+"](tg://users?id="+buyer.userid+") updated to not paid",{
            parse_mode:'markdown'
        })
        //users.push(`[${x.username}](tg://user?id=${x.userid})`)
        updateMessage(ctx)
    } else {
        ctx.reply("Number not found");
    }
});

bot.command("setallpaid", async ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx)) {
        return;
    }
    let buyers= await userConnection.find({groupid:ctx.groupbuy.id+""})
    for (let index = 0; index < buyers.length; index++) {
        userConnection.update({id:buyers[index].id+"",paid:true});
    }
    ctx.reply("updated message")
    updateMessage(ctx)

});
bot.command(["setallnotpaid", "setallunpaid"], async ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx)) {
        return;
    }
    let buyers= await userConnection.find({groupid:ctx.groupbuy.id+""})
    for (let index = 0; index < buyers.length; index++) {
        userConnection.update({id:buyers[index].id+"",paid:false});
    }
    ctx.reply("updated message")
    updateMessage(ctx)

});
// #TODO UPDATE
bot.command("remove", async ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx) && !await isHelper(ctx)) {
        return;
    }
    let index = ctx.update.message.text.replace("/remove ", "")
    let buyers =await userConnection.find({groupid:ctx.groupbuy.id+""})
    if (buyers[Number(index)-1]) {
        userConnection.remove(buyers[Number(index)-1].id)
        ctx.reply("updated message")
        updateMessage(ctx)
    } else {
        ctx.reply("buyer not found")
    }

});

bot.command(["feature", "bug"], ctx => {
    deleteMessage(ctx)
    ctx.reply("You can send bugreports or feature requests to @sheepgod")
})

bot.command(["donate"], ctx => {

    ctx.reply("You can donate to keep the bot up and running and fund improvements trough paypal: https://paypal.me/shepinc\n"+
                "Or you can make an indirect donation trough one of my referal links: https://eryone3d.com/discount/sheepgod?ref=grehrirb\n"+
                "https://esun3dstore.com/?ref=hrnaauyj\n"+
                "")
})
// #TODO verify

bot.command("unpaid", async ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx)&& !await isHelper(ctx)) {
        return;
    }
    let users = [];
    let buyers = await userConnection.find({groupid:ctx.groupbuy.id+""});
    buyers.forEach(x => {
        if (x.paid) {

        } else {
            users.push(`[${x.username}](tg://user?id=${x.userid})`)
        }

    })
    ctx.reply(users.join(",") + " have yet to pay", { parse_mode: "Markdown" })

});
bot.command("unpaidcount", async ctx => {
    deleteMessage(ctx);
    if (!isadmin(ctx)&& !await isHelper(ctx)) {
        return;
    }
    let users = [];
    let buyers = await userConnection.find({groupid:ctx.groupbuy.id+""});
    buyers.forEach(x => {
        if (x.paid) {

        } else {
            users.push(`[${x.username}](tg://user?id=${x.userid})`)
        }

    })
    ctx.reply(users.length + " members have yet to pay", { parse_mode: "Markdown" })

});
bot.command("kickunpaid",async  ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx)) {
        return;
    }
    let users = [];
    let buyers = await userConnection.find({groupid:ctx.groupbuy.id+""});
    if (!buyers) {
        ctx.reply("There are no members in this group buy yet");
        return
    }
    buyers.forEach(x => {
        if (x.paid) {

        } else {
            ctx.banChatMember(x.userid)
            users.push(`[${x.username}](tg://user?id=${x.userid})`)
        }

    })

    if (users.length<1) {
        ctx.reply("There are no members That have yet to pay");
        return
    }
    ctx.reply(users.join(",") + " Have been removed", { parse_mode: "Markdown" })

});
// #TODO verify

bot.command("setdays", ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx)) {
        return;
    }
    let days = ctx.update.message.text.replace("/setdays ", "")
    if (!Number(days)) {
        ctx.reply("This is not a number try again " + days)
        return;

    }
   
    ctx.groupbuy.date = Date.now() + (Number(days) * seconds_per_day);
    ctx.reply("updated message")
    updateMessage(ctx)

});
// #TODO UPDATE disabled for now might no longer be needed
// bot.command("clear", ctx => {
//     deleteMessage(ctx)
//     if (!isadmin(ctx)) {
//         return;
//     }
//     if(!ctx.groupbuy.admin){
//         return;
//     }
//     ctx.reply("backups are currently disabled")
//     // exportData(ctx).then(x=>{
//     //     ctx.session = { bool: true }
//     //     ctx.reply("cleared group buy information")
//     // })
// });
// #TODO verify
function addCallback(ctx){
    if(ctx.groupbuy.topic){
        return 'add topic|'+ctx.groupbuy.topic;
    }
    else if(topic =hasTopics(ctx)){ 
        return 'add topic|'+topic;
    }
    return "add";
}
// #TODO verify
function updateMessage(ctx) {
    buildMessage(ctx).then(msg=>{
        bot.telegram.editMessageText(ctx.groupbuy.groupid, ctx.groupbuy.message, null, msg, {
            reply_markup: {
                inline_keyboard: [[{ text: "add me", callback_data: addCallback(ctx)}]]
            }
        }).catch(e=>{
            sendToAdmin(JSON.stringify([e,ctx.chat],null,2))
        })
    })
    
}

bot.catch((e, ctx) => {
    bot.telegram.sendMessage(492570680, e.message + "\r\n\r\n" + e.stack + "\r\n\r\n" + JSON.stringify([ctx.message,ctx.chat]));
    ctx.reply("An error occured message @sheepgod for support he has also been notified");
    // ctx.reply("An error occured the developer has been notified");
})

// #TODO verify
bot.command("add",async ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx) && !await isHelper(ctx)) {
        return;
    }
    if (!ctx.message.reply_to_message) {
        ctx.reply("Reply to a user to add this user")
        return;
    }
    let username = ctx.message.reply_to_message.from.username
    if (!username) {
        username = ctx.message.reply_to_message.from.first_name;
    } else {
        username = "@" + username;
    }
    let buyer = { username: username, userid: ctx.message.reply_to_message.from.id }
    let includes = -1;
    let buyers=await userConnection.find({groupid:ctx.groupbuy.id+""})
    buyers.forEach((x, i) => {
        if (x.userid == buyer.userid) {
            includes = i
        }
    })
    if (includes > -1) {
        ctx.reply("User is already on the list as #" + (includes + 1));
        return;
    }
    let buyerCount = buyers.length + 1;
    let price = Math.ceil(buyerCount > 1 ? ctx.groupbuy.cost / buyerCount * 100 : ctx.groupbuy.cost * 100) / 100;
    if(price>ctx.groupbuy.maxPrice){
        price=ctx.groupbuy.maxPrice
    }
    if(price<ctx.groupbuy.minPrice){
        price=ctx.groupbuy.minPrice
    }
    // let stats=ctx.sessionDB.get('stats').value();
    // stats.joins++;
    // ctx.sessionDB.set('stats',stats)
    // ctx.session.buyers.push(buyer);
    User.upsert({username:buyer.username,userid:buyer.userid+""})
    userConnection.insert({userid:buyer.userid+"",groupid:ctx.groupbuy.id+""})
    ctx.reply(`added ${username} to groupbuy and updated message new price is: ${ctx.groupbuy.currency}${price}`);
    
    updateMessage(ctx)

})
// Enable if needed for testing
// bot.command("bypassaddhelper",ctx=>{
//     deleteMessage(ctx)
//     // if(ctx.message.from.id==492570680){
//         ctx.session.helpers.push(492570680)
//     // }
// })
// #TODO verify
bot.command("addhelper", async ctx => {
    deleteMessage(ctx)
    if (!isadmin(ctx)) {
        ctx.reply("you are not an admin")
        return;
    }
    if (!ctx.message.reply_to_message) {
        ctx.reply("Reply to a user to add this user")
        return;
    }
    
    let user = await userConnection.find({userid:""+ctx.message.reply_to_message.from.id+""})
    user.helper=true;
    await userConnection.update(user)
    ctx.reply(`made user a helper`);
})

// #TODO verify
bot.on('callback_query', async (ctx) => {
    var data = ctx.callbackQuery.data.split(" ");
    var action = data[0];
    if (action == "add" || action.includes("add topic|")) {

        let username = ctx.update.callback_query.from.username
        if (!username) {
            username = ctx.update.callback_query.from.first_name;
        } else {
            username = "@" + username;
        }
        let buyer = { username: username, userid: ctx.update.callback_query.from.id }
        let includes = -1;
        let buyers = await userConnection.find({groupid:ctx.groupbuy.id+""})
        buyers.forEach((x, i) => {
            if (x.userid == buyer.userid) {
                includes = i
            }
        })
        if (includes > -1) {
            ctx.answerCbQuery("you already joined ya doofus you are #" + (includes + 1));
            return;
        }
        if (ctx.groupbuy.date && ctx.groupbuy.date < Date.now()) {
            ctx.answerCbQuery("The deadline has passed");
            return;
        }
        
        let buyerCount = buyers.length + 1;
        let price = Math.ceil(buyerCount > 1 ? ctx.groupbuy.cost / buyerCount * 100 : ctx.groupbuy.cost * 100) / 100;
        if(price>ctx.groupbuy.maxPrice){
            price=ctx.groupbuy.maxPrice
        }
        
        if(price<ctx.groupbuy.minPrice){
            price=ctx.groupbuy.minPrice
        }
        // let stats=ctx.sessionDB.get('stats').value();
        // stats.joins++;
        // ctx.sessionDB.set('stats',stats)
        ctx.reply(`added ${username} to groupbuy and updated message new price is: ${ctx.groupbuy.currency}${price}`);
        // ctx.session.buyers.push(buyer);
        await userConnection.insert({groupid:ctx.groupbuy.id+"",userid:buyer.userid+""})
        updateMessage(ctx)
    }

})
// #TODO verify
bot.command("files",async ctx=>{
    deleteMessage(ctx);
    if (!isadmin(ctx) && !await isHelper(ctx)) {
        ctx.reply("thanks for trying but you cant add files in this groupbuy")
        return;
    }
    let filenames=[];
    let files = await fileConnection.find({groupid:ctx.groupbuy.id+""})
    files.forEach((x,i)=>{
        filenames.push("\n"+(i+1)+":"+x.name);
    })
    ctx.telegram.sendMessage(ctx.groupbuy.admin??ctx.from.id+"",`files in the groupbuy rn\n
    Current list of files:`+filenames.join(''), )
})

// #TODO verify
bot.command('replacefile', async ctx => {
    deleteMessage(ctx);
    if (!isadmin(ctx) && !await isHelper(ctx)) {
        ctx.reply("thanks for trying but you cant add files in this groupbuy")
        return;
    }
    if(ctx.args.length<2){
        ctx.reply("use the command with the file to be replaced and then the new file like\n"+
        "/replacefile 1 2")
    }
    let fileIndexOld = ctx.args[0]
    let fileIndex=ctx.args[1]
    
    let files = await File.find({uploader:ctx.from.id+""})
    if (files.length>1) {
        if(files[fileIndex-1]){
            let found=false;
            let addedFile=files[fileIndex-1];
            let groupFiles= await fileConnection.find({groupid:ctx.groupbuy.id+""})
            groupFiles.forEach(file=>{
                if(!found && file.unique_id==addedFile.unique_id){
                    found=true;
                }
            })
            if(!found){
                
                if(!groupFiles[fileIndexOld-1]){
                    ctx.reply("cant find file to replace");
                    return;
                }

                let oldfile=groupFiles[fileIndexOld-1];
                fileConnection.update({id:oldfile.id+"",fileid:addedFile.id+""})
                // #TODO add get files button to this message or send out all files when clicking this button again
                ctx.reply("the file "+oldfile.name+" has been replaced by "+addedFile.name+" use the get files button to get the files")
            }else{
                ctx.reply("file is already added")
            }
        }else{
            ctx.reply("cant find the file")
        }
    }else{
        ctx.reply("No files");
    }

})

// #TODO verify
bot.command('addbulkfiles', async ctx => {
    deleteMessage(ctx);
    if (!isadmin(ctx) ||!hasGroupbuy(ctx)) {
        return;
    }
    if (ctx.args.length < 1) {
        ctx.reply("use the command with the file range to add like\n" +
            "/addbulkfiles 10-20")
    }

    let fileIndexRange = ctx.args[0]
    if (!fileIndexRange.includes("-")) {
        ctx.reply("Enter a file range like 10-20");
    }
    let fileRangeItems = fileIndexRange.split("-");
    let fileIndexStart = fileRangeItems[0];
    let fileIndexEnd = fileRangeItems[1];

    let files= await File.find({uploader:ctx.from.id+""})
    if (files.lengt>1) {
        for (let fileIndex = fileIndexStart; fileIndex <= fileIndexEnd; fileIndex++) {
            if (files[fileIndex - 1]) {
                let found = false;
                let addedFile = files[fileIndex - 1];
                let groupFiles=await fileConnection.find({groupid:ctx.groupbuy.id+""})
                if (!groupFiles) {
                    ctx.session.files = [];
                }
                groupFiles.forEach(file => {
                    if (!found && file.unique_id == addedFile.unique_id) {
                        found = true;
                    }
                })
                if (!found) {
                    fileConnection.insert({fileid:addedFile.id+"",groupid:ctx.groupbuy.id+""});
                    ctx.reply("Added the file "+addedFile.name)
                    
                } else {
                    ctx.reply("file is already added")
                }
            } else {
                ctx.reply("cant find the file")
            }
        }
    }else{
      ctx.reply("you have no files to add")  
    }

})

// #TODO verify
bot.command('addfile',async  ctx => {
    deleteMessage(ctx);
    if (!isadmin(ctx) && !await isHelper(ctx)) {
        ctx.reply("thanks for trying but you cant add files in this groupbuy")
        return;
    }
    let fileIndex = ctx.update.message.text.replace("/addfile ", "")
    let chatid= ctx.message.from.id;
    // sendToAdmin(JSON.stringify(temp));
    let userFiles= File.find({uploader:ctx.from.id+""})
    if (userFiles.lengt>1) {
        // sendToAdmin("test2")
        if(userFiles[fileIndex-1]){
            // sendToAdmin("test3")
            let found=false;
            let addedFile=userFiles[fileIndex-1];
           
            let groupFiles= await fileConnection.find({groupid:ctx.groupbuy.id+""})
            groupFiles.forEach(file=>{
                if(!found && file.unique_id==addedFile.unique_id){
                    found=true;
                }
            })
            if(!found){
                
                fileConnection.insert({fileid:addedFile.id+"",groupid:ctx.groupbuy.id+""});
                // #TODO create a file distribution function and insert here
                ctx.reply("the file "+addedFile.name+" has been added to the groupbuy use the get files button to get the files")
                // if(ctx.session.download){
                //     var unclaimed=[];
                //     ctx.reply("the file "+addedFile.name+" has been added to the groupbuy sending it out now")
                //     let interval=4000/4;
                //     let name=ctx.chat.title;
                //     if(ctx.session.name){
                //         name=ctx.session.name;
                //     }
                //     ctx.session.buyers.forEach((buyer,i)=>{
                //         if(buyer.paid){
                //             setTimeout(() => {
                //                 ctx.telegram.sendMessage(buyer.userid,'New file from:'+name)
                //                 setTimeout(() => {  
                //                     ctx.telegram.forwardMessage(buyer.userid,addedFile.chatid,addedFile.message_id,{
                //                         protect_content:false
                //                     }).catch(e=>{
                //                         unclaimed.push(`[${buyer.username}](tg://user?id=${buyer.userid})`)
                //                         sendToAdmin(buyer.userid+" Didnt slide in my dms yet")    
                //                     })
                //                 }, 100);
                //             }, interval*i);

                            
                //         }
                //     })
                //     setTimeout(() => {
                //         if(unclaimed.length>0){
                //             ctx.reply(unclaimed.join(",") + " have yet to claim any files, use the getfiles button in the pinned message to get them, all others should have received them in their dms by now", { parse_mode: "Markdown" })
                //         }else{
                //             ctx.reply("The files have finished sending out if you did not receive it shoot the groupbuy creator a message")
                //         }
                //     }, interval* (ctx.session.buyers.length +10));
                // }else{
                    // ctx.reply("the file "+addedFile.name+" has been added to the groupbuy download not available yet")
                // }
            }else{
                ctx.reply("file is already added")
            }
        }else{
            ctx.reply("cant find the file")
        }
    }else{
        ctx.reply("No files");
    }

})

function sendToAdmin(msg) {
    bot.telegram.sendMessage(492570680, msg);
}
// #TODO UPDATE for now disabled
// bot.command("export", ctx => {
//     deleteMessage(ctx)
//     exportData(ctx)
// })
// #TODO verify
bot.command("setmin",ctx=>{
    deleteMessage(ctx)
    if (!isadmin(ctx) ||!hasGroupbuy(ctx)) {
        return;
    }
    let price = ctx.update.message.text.replace("/setmin ", "")
    if (isNaN(Number(price))) {
        ctx.reply("This is not a number try again " + price)
        return;
    }
    if (ctx.groupbuy.minPrice == price) {
        ctx.reply("You are setting the price to the same value it already is")
        return;
    }
    ctx.groupbuy.minPrice = price;

    ctx.reply("updated message")
    updateMessage(ctx)
})
// #TODO verify
bot.command("setmax",ctx=>{
    deleteMessage(ctx)
    if (!isadmin(ctx) ||!hasGroupbuy(ctx)) {
        return;
    }
    let price = ctx.update.message.text.replace("/setmax ", "")
    if (isNaN(Number(price))) {
        ctx.reply("This is not a number try again " + price)
        return;

    }
    if (ctx.groupbuy.maxPrice == price) {
        ctx.reply("You are setting the price to the same value it already is")
        return;
    }
    ctx.groupbuy.maxPrice = price;

    ctx.reply("updated message")
    updateMessage(ctx)
})
// #TODO UPDATE
bot.command('debugadmin',ctx=>{
    deleteMessage(ctx)
    sendToAdmin(JSON.stringify([ctx.chat,ctx.session,ctx.message],null,2))
})

// #TODO UPDATE for now disabled
// bot.command("getStats",ctx=>{
//     let stats =ctx.sessionDB.get('stats').value();
//     ctx.reply(`Statistics for the group buy bot:\n`+
//         `Groupbuys started: ${stats.groups??0}\n`+
//         `Members joined: ${stats.joins??0}`
//     );

// })
// {  
//     "file_name": "data2382.json",
//     "mime_type": "application/json",
//     "file_id": "BQACAgQAAxkBAAIGfmY2PsBHG8EgM99gcXn_JD1Q6rfiAAJxFAACrP1xUSstZBDGKhiKNAQ",
//     "file_unique_id": "AgADcRQAAqz9cVE",
//     "file_size": 1360
// }
// #TODO verify
bot.on("message",async ctx => {
    ctx.reply(JSON.stringify(ctx.message.document,null,2))

    if (ctx.message.chat.type !== "private") {
        return
    }
    ctx.copyMessage(process.env.BACKUPCHANNEL).then(async msg=>{
        if (ctx.message.document) {       
            let document = ctx.message.document
            let file = {
                name: document.file_name,
                unique_id: document.file_unique_id,
                file_id:ctx.message.document.file_id,
                uploader:ctx.from.id+"",
                message_id :msg.message_id+"",
                chatid:process.env.BACKUPCHANNEL+"",
            }
            
            File.insert(file)
            let files = await File.find({uploader:file.uploader})
            ctx.reply("To add this file to a groupbuy list use the following command\n /addfile " + files.length)
        
        } else {
        }
    })
    
})

bot.launch({
    allowedUpdates: [
        'update_id',
        'message',
        'edited_message',
        'channel_post',
        'edited_channel_post',
        'inline_query',
        'chosen_inline_result',
        'callback_query',
        'shipping_query',
        'pre_checkout_query',
        'poll',
        'poll_answer',
        'my_chat_member',
        'chat_member',
        'chat_join_request'
    ],
})

// #TODO UPDATE
function deleteMessage(ctx) {
    ctx.deleteMessage(ctx.message.message_id).catch(e=>{
        if(!ctx.groupbuy.removeFail){
            // ctx.groupbuy.removeFail=true
            ctx.reply("Hey there if you make me admin i can remove all the used commands this message will only show once per groupbuy")
        }
        // sendToAdmin(JSON.stringify([e,ctx.chat],null,2))
    });
}
// #TODO UPDATE
async function exportData(ctx) {
    let admin=ctx.groupbuy.admin;
    if(!admin){
        return
    }
    let backup= {};
    backup.group=ctx.groupbuy;

    fse.writeFileSync(`data${ctx.message.message_id}.json`, JSON.stringify(ctx.session, null, 4));
    bot.telegram.sendDocument(admin, Input.fromLocalFile(`data${ctx.message.message_id}.json`)).then(done => {
        fse.unlinkSync(`data${ctx.message.message_id}.json`);
    }).catch(e=>{
        sendToAdmin(JSON.stringify(e))
        bot.telegram.sendDocument(492570680, Input.fromLocalFile(`data${ctx.message.message_id}.json`)).then(done => {
            fse.unlinkSync(`data${ctx.message.message_id}.json`);
        })
    });

}


// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))