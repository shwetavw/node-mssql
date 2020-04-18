//Import modules
const express = require('express')
const sql = require("mssql")
const dotenv = require( "dotenv" );

// read in the .env file
dotenv.config();

// Read environment variables
const { PORT,
    SQL_USER,
    SQL_PASSWORD,
    SQL_SERVER,
    SQL_DATABASE

} = process.env;

//Initialize an instance of express
const app = express()
const port = PORT || 3000

// config for database
var sqlConfig = {
    user: SQL_USER,
    password: SQL_PASSWORD,
    server: SQL_SERVER, 
    database: SQL_DATABASE,
    options: {
        enableArithAbort: true,
        encrypt: false
      }
};

//Get user detail (async/await approach)
const fnGetUser = async (id)=>{
    try{
        const conn = await sql.connect(sqlConfig)
        try{
            const result = await conn.request()
                            .input('userId', sql.Int, id)
                            .query('select * from userdetail where userid = @userId')
            if(result.recordset.length > 0){         
                return result.recordset  
            }
            else{
                return 'User not found.'
            }
        }
        catch(err){
            console.log(err)
            conn.close()
        }
    }
    catch(err){
        console.log(err)
    }
}

//Get category (async/await approach)
const fnGetCategoryId = async (name)=>{
     try{
        const conn = await sql.connect(sqlConfig)
        try{
            const result = await conn.request()
                            .input('categoryName', sql.NVarChar, name)
                            .query('select * from Category where category = @categoryName')
            if(result.recordset.length > 0){        
                return result.recordset[0].CategoryId
            }
            else{
                return ''
            }
        }
        catch(err){
            console.log(err)
            conn.close()
        }
    }
    catch(err){
        console.log(err)
    }
}

//Insert category details (promise approach)
function fnInsertCategory(category) {
    const conn = new sql.ConnectionPool(sqlConfig)
    conn.connect()
        .then(() => {
            const transaction = new sql.Transaction(conn)
            transaction.begin()
                .then(() => {
                    const request = new sql.Request(transaction)
                    request.input('Category', sql.NVarChar(50), category.name)
                    request.input('Description', sql.NVarChar(200), category.description)            
                    request.execute('InsertCategory')
                            .then((result) => {
                                console.log(result.rowsAffected);
                                transaction.commit()
                                            .then(() => {
                                                conn.close();
                                            }).catch((err) => {
                                                console.log("Error in Transaction Commit " + err);
                                                conn.close();
                                            });
                            })
                            .catch((err) => {
                                transaction.rollback()
                                    .then(()=>{
                                        conn.close()
                                    })                                
                                console.log("Error in SP execution" + err);
                            });
                
                })
                .catch((err) => {
                    console.log("Error in Transaction Begin " + err);
                    conn.close();
            });
        })
        .catch((err) => {
            console.log(err);
        });
}

//Insert product in bulk for a given category
const fnInsertProducts = async (product)=>{
    const tblProducts = new sql.Table('Product') 
    tblProducts.create = false
    tblProducts.columns.add('ProductName', sql.NVarChar(50))
    tblProducts.columns.add('Description', sql.NVarChar(200))
    tblProducts.columns.add('CategoryId', sql.Int)
    tblProducts.columns.add('Quantity', sql.Int)
    tblProducts.columns.add('InStock', sql.Bit)

    
    for(let i=0; i < product.length; i++){
        tblProducts.rows.add(product[i].productName, product[i].description, product[i].categoryId, product[i].quantity, product[i].inStock)
    }

    try{
        const conn = await sql.connect(sqlConfig)
        try{
            const result = await conn.request()
                                    .bulk(tblProducts)            
        }catch(err){
            console.log('Error in bulk insert ' + err)
            conn.close()
        }
    }catch(err){
        console.log('Error :' + err)
    }
    
}

app.get('/',(req,res)=>{
    res.send('Home page')
})

app.get('/getuser/:id',(req,res)=>{
    fnGetUser(req.params.id)
    .then((data)=>{
        res.send(data)
    })
    .catch((err)=>{
        res.send(err)
    })
})

app.get('/icategory',(req,res)=>{
    let category = {
        name: 'Electronics',
        description: 'Electronic devices like Mobile, Laptop, Power Bank'
    }

    fnInsertCategory(category)
    res.send('Category saved.')
})

app.get('/iproducts/:categoryname',(req,res)=>{
    if(req.params.categoryname !== 'undefined'){
       fnGetCategoryId(req.params.categoryname)  
            .then((result)=>{      
                const categoryId = result       
            if(categoryId !== ''){
                const products = [
                    { productName: 'iPhone11', description: 'iPhone11 Mobile', categoryId, quantity: 2, inStock: true},
                    { productName: 'Mi Max', description: 'Mi Mobile with 64 GB Ram', categoryId, quantity: 5, inStock: true},
                    { productName: 'Redmi Note 10', description: 'Redmi note 10 mobile with 256 GB Ram', categoryId, quantity: 1, inStock: true}
                    ]
                    fnInsertProducts(products)
                        .then(()=>{
                            res.send('Products saved.')
                        })
                        .catch((err)=>{
                            res.send('Error in product insert')
                        })
                    
            }            
        })
        .catch((err)=>{
           res.send(err)
        })        
    }
    else{
        res.send('Invalid query string.')
    }
   
})

app.listen(port,()=>{
    console.log(`server is running on port ${port}`)
})