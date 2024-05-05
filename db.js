(async () => {
    try {
        await knex.schema.dropTableIfExists('groupbuys')
        await knex.schema.dropTableIfExists('files')
        await knex.schema.dropTableIfExists('users')
        await knex.schema.dropTableIfExists('groupbuyUserConnection')
        await knex.schema.dropTableIfExists('groupbuyFileconnection')
        await knex.schema.createTable("groupbuys",function(table){
            table.increments()
            table.string("groupid")
            table.string("topic")
            table.string("end_date")
            table.string('message')
            table.string('description')
            table.string('currency')
            table.float('cost')
            table.string('admin')
            table.string('link')
        })
        await knex.schema.createTable("files",function(table){
            table.increments()
            table.string("name")
            table.string("unique_id")
            table.string('chat_id')
            table.string('message_id')
            table.string('uploader')
        })
        await knex.schema.createTable("users",function(table){
            table.string("username").unique()
            table.string("userid")  
        })

        await knex.schema.createTable("groupbuyUserConnection",function(table){
            table.increments()
            table.string("userid")  
            table.string('groupid')
            table.boolean('paid')
            table.boolean('helper')
        })
        await knex.schema.createTable("groupbuyFileconnection",function(table){
            table.increments()
            table.string("fileid")  
            table.string('groupid')
            table.foreign('fileid').references('id').inTable('files');
            table.foreign('groupid').references('id').inTable('groupbuys');
        })

          User.insert({
            userid:'492570680',
            username:'sheepgod'
          }).then(
            e=>{
        Groupbuy.insert({
            groupid:"-1002075870949",
            description:"test",
            message:"10",
            currency:"$",
            cost:10,
            admin:"492570680",
            link:'',
        })
        userConnection.insert(
            {
                groupid:2,
                userid:'492570680'
            }
        )
        
        User.find({ userid: '492570680' }).then(user => {

        })

        User.getGroups('492570680').then(user => {
            console.log(user)
        })
        }
          )

    }
    catch (e) {
        console.log(e)
    }
})()
