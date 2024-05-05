
const Model = require('@ruanmartinelli/knex-model').default;
module.exports={
    userModel: class userModel extends Model {
        constructor(options) {
            super(options)
        }
        getGroups(id) {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(this.tableName).where('users.userid', id)
                .leftJoin('groupbuyUserConnection', 'users.userid', 'groupbuyUserConnection.userid')
                .leftJoin('groupbuys', 'groupbuys.id', 'groupbuyUserConnection.groupid')
                .whereNotNull('groupbuys.id').select('groupbuys.*')
    
        }
        getFiles(id) {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(this.tableName).where('users.userid', id)
                .leftJoin('files', 'users.userid', 'files.uploader')
                .select('files.*').whereNotNull('files.id')
    
        }
    },
    fileModel:class fileModel extends Model {
        constructor(options) {
            super(options)
        }
        getGroups() {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(options.tableName)
                .select('groupbuys.*')
    
        }
    },
    groupModel: class groupModel extends Model {
        constructor(options) {
            super(options)
        }
        getUsers(id) {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(this.tableName).where('groupbuys.id', id)
                .leftJoin('groupbuyUserConnection', 'groupbuys.userid', 'groupbuyUserConnection.groupid')
                .leftJoin('users', 'users.id', 'groupbuyUserConnection.userid')
                .whereNotNull('groupbuys.id').select('users.*,groupbuyUserConnection.paid,groupbuyUserConnection.helper')
    
        }
        getFiles(id) {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(this.tableName).where('groupbuys.id', id)
                .leftJoin('groupbuyFileconnection', 'groupbuys.userid', 'groupbuyFileconnection.groupid')
                .leftJoin('files', 'files.id', 'groupbuyFileconnection.userid')
                .whereNotNull('groupbuys.id').select('files.*')
    
        }
        getPaidUsers(id) {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(this.tableName).where('groupbuys.id', id)
                .where('groupbuyUserConnection.paid', 'true')
                .leftJoin('groupbuyUserConnection', 'groupbuys.id', 'groupbuyUserConnection.groupid')
                .leftJoin('users',  'groupbuyUserConnection.userid','users.id')
                .whereNotNull('groupbuys.id').select('groupbuys.*')
    
        }
        getHelpersUsers(id) {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(this.tableName).where('groupbuys.id', id)
                .leftJoin('groupbuyUserConnection', 'groupbuys.id', 'groupbuyUserConnection.groupid')
                // .leftJoin('users', 'users.id', 'groupbuyUserConnection.userid')
                .where('groupbuyUserConnection.helper', 'true')
                .whereNotNull('groupbuys.id').select('groupbuyUserConnection.*')
    
        }
        getUnpaidUsers(id) {
            // You can use the "knex" instance inherited from the Model class
            return this.knex(this.tableName).where('groupbuys.id', id)
                .whereNot('groupbuyUserConnection.paid', 'true')
                .leftJoin('groupbuyUserConnection', 'groupbuys.id', 'groupbuyUserConnection.groupid')
                .leftJoin('users', 'groupbuyUserConnection.userid', 'users.id')
                .whereNotNull('groupbuys.id').select('groupbuys.*')
    
        }
        async getActiveGroupbuy(id){
            let group=await this.knex(this.tableName).where('groupid',id).orderBy('id','desc').first()
            if(!group){
                group = await this.knex(this.tableName).insert({groupid:id})
                group=await this.knex(this.tableName).where('id',group[0]).orderBy('id','desc').first()
            }
            return group
        }
    }
}