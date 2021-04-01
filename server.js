require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const fs = require('fs')

const app = express()
const PORT = process.env.PORT || 3306
const db = require('./dbconfig')

app.use(cors({
    origin: "https://www.loving-mendel.144-91-112-39.plesk.page",
    credentials: true
}))
app.use(express.json())
// app.use(express.static(__dirname + '/upload'))
app.use(bodyParser.urlencoded({extended:true}))
app.use(fileUpload())
app.use(cookieParser())

const saltRounds = 10
const Token = {
    access: {
        secretKey: "diariko:access_token_29m8v11468hls5i647bzcaq708v5o071lark526p",
        expiresIn: 3600 // 1h = 3600s
    },
    refresh: {
        secretKey: "diariko:refresh_token_bg2e6qk295w644nh0vjjn1ugk1z1fnu6y44d553o",
        expiresIn: 604800 // 7d
    } 
}
let xsrf = ""

const Random = (long,caseSensitivity) => {
    let tmp = ""
    const alphabet = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"]
    
    for (let index = 0; index < long; index++) {
        const charOrNumber = Math.floor(Math.random() * (1 - 0 + 1) ) + 0
        const caseType = Math.floor(Math.random() * (1 - 0 + 1) ) + 0
        let char = (charOrNumber === 0)? alphabet[(Math.floor(Math.random() * (25 - 0 + 1) ) + 0)] : Math.floor(Math.random() * 10)  
        caseSensitivity && charOrNumber === 0 && caseType === 1 && (char = char.toUpperCase())
        tmp += char  
    }
    
    return tmp
}

const getTokenXsrf = (id, tokenType) => {
    let tmp = ""
    let token = ""
    do {
        xsrf = Random(255,false)
        const hash = bcrypt.hashSync(xsrf, saltRounds)
        token = jwt.sign({id:id, xsrf: hash}, tokenType.secretKey, {expiresIn: tokenType.expiresIn})
        db.query("SELECT userId FROM token where value='" + token + "'", (error,result) => {
            tmp = result
        })
    } while (tmp.length > 0)
    return {token: token, xsrf: xsrf}
}

const authTokenXsrf = (cookies,headers) => {
    if(!cookies || !cookies.refreshToken) return {id: null, state: "token missing", newFullTokenXsrf: null}
    if(!headers || !headers.xsrf) return {id: null, state: "xsrf missing", newFullTokenXsrf: null}

    let decode = null

    try {
        if(cookies.accessToken){
            decode = jwt.verify(cookies.accessToken,Token.access.secretKey)
            const xsrf = JSON.parse((headers.xsrf))
            if(!bcrypt.compareSync(xsrf.accessXsrf, decode.xsrf)){
                return {id: null, state: "access token invalid", newFullTokenXsrf: null}
            }
            db.query("SELECT phoneNumber FROM user WHERE id='" + decode.id + "'", (error,result) => {
                if(result.length > 0){
                    return {id: decode.id, state: "access token valid", newFullTokenXsrf: null}
                }else return {id: null, state: "access token invalid", newFullTokenXsrf: null}
            })
        } else {
            let error = new Error
            error.name = "access token missing"
            throw error
        }
    } catch (error) {
        if(error.name === "TokenExpiredError" || error.name === "access token missing"){
            try {       
                decode = jwt.verify(cookies.refreshToken,Token.refresh.secretKey)
                const xsrf = JSON.parse((headers.xsrf))
                if(!bcrypt.compareSync(xsrf.refreshXsrf, decode.xsrf)) throw Error
            } catch (err) {
                return {id: null, state: "invalid", newFullTokenXsrf: null}
            }
            decode = jwt.decode(cookies.refreshToken)
            db.query("SELECT phoneNumber FROM user WHERE id='" + decode.id + "'", (error,result) => {
                if(result.length > 0){
                    return {id: decode.id, state: "access token expired and renewed", newFullTokenXsrf: {accessTokenXsrf: getTokenXsrf(decode.id,Token.access), refreshTokenXsrf: getTokenXsrf(decode.id,Token.refresh)}}
                }else return {id: null, state: "refresh token invalid", newFullTokenXsrf: null}
            })
        }else return {id: null, state: "token invalid", newFullTokenXsrf: null}
    }
}


app.post("/diariko/user/username", (req,res) => {
    const {condition} = req.body
    db.query("SELECT id FROM user WHERE username='" + condition + "' AND isActivate=1", (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/user/phonenumber", (req,res) => {
    const {condition} = req.body
    db.query("SELECT id FROM user WHERE phoneNumber='" + condition + "' AND isActivate=1", (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/country/contryDialCode", (req,res) => {
    const {condition} = req.body
    db.query("SELECT dialCode FROM country WHERE id=" + condition, (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/country", (req,res) => {
    db.query("SELECT id,name FROM country ORDER by name ASC", (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/region", (req,res) => {
    const {condition} = req.body
    db.query("SELECT id,name FROM region WHERE countryId=" + condition + " ORDER by name ASC", (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/region/one", (req,res) => {
    const {condition} = req.body
    db.query("SELECT countryId FROM region WHERE id=" + condition, (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/town", (req,res) => {
    const {condition} = req.body
    db.query("SELECT id,name FROM town WHERE regionId=" + condition + " ORDER by name ASC", (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/coordinate", (req,res) => {
    const {condition} = req.body
    let Data = []
    db.query("SELECT id,name FROM country WHERE name LIKE '%" + condition + "%'", (error,result) => {
        let tmp = result.map(item => {
            return {id:item.id,value:item.name,ref:"",type:"country"}
        })
        Data = Data.concat(tmp)
    })

    db.query("SELECT id,name,countryId FROM region WHERE name LIKE '%" + condition + "%'", (error,result) => {
        let tmp = result.map(item => {
            return {id:item.id,value:item.name,ref:item.countryId,type:"region"}
        })
        Data = Data.concat(tmp)
    })

    db.query("SELECT id,name,regionId FROM town WHERE name LIKE '%" + condition + "%'", (error,result) => {
        let tmp = result.map(item => {
            return {id:item.id,value:item.name,ref:item.regionId,type:"town"}
        })
        Data = Data.concat(tmp)
        res.send(Data)
    })
})

app.post("/diariko/signIn", (req,res) => {
    const {firstName,name,username,phoneNumber,password,day,month,year,gender,country,region,town,address} = req.body.data
    const birthday = year + "-" + ((month < 10)? "0" + month : month) + "-" + ((day < 10)? "0" + day : day)
    const hash = bcrypt.hashSync(password, saltRounds)
    let tmp = []
    let id = ""

    do {
        id = Random(40,false)
        db.query("SELECT phoneNumber FROM user where id='" + id + "'", (error,result) => {
            tmp = result
        })
    } while (tmp.length > 0)

    db.query("INSERT INTO user (id,firstName,name,username,phoneNumber,password,birthday,gender,country,region,town,address,isActivate,createdAt,updatedAt) VALUES ('" + id + "','" + firstName + "','" + name + "','" + username + "','" + phoneNumber + "','" + hash + "','" + birthday + "','" + gender + "'," + country + "," + region + "," + town + ",'" + address + "'," + 0 + ",NOW(),NOW())", (error,result) => {
        if(!error){
            res.send("ok")
        }
    }) 
})

app.post("/diariko/user/activate", (req,res) => {
    const {condition} = req.body
    db.query("UPDATE user SET isActivate=1 WHERE phoneNumber='" + condition + "'",(error,result) => {
        if(!error){
            db.query("SELECT id FROM user WHERE phoneNumber='" + condition + "'", (error,result) => {
                const {id} = result[0]
                let data = getTokenXsrf(id,Token.access)
                const accessToken = data.token
                const accessXsrf = data.xsrf
                data = getTokenXsrf(id,Token.refresh)
                const refreshToken = data.token
                const refreshXsrf = data.xsrf
                
                res.cookie('accessToken', accessToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: false,
                    maxAge: (Token.access.expiresIn * 1000) // convert seconds to milliseconds
                })
                
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: false,
                    maxAge: (Token.refresh.expiresIn * 1000)
                })

                console.log({accessToken:accessToken,refreshToken:refreshToken})
                
                res.send({diarikoXsrf:{accessXsrf: accessXsrf, refreshXsrf: refreshXsrf}})
            })
        }
    })
})

app.post("/diariko/identifiant", (req,res) => {
    const {identifiant} = req.body
    db.query("SELECT id FROM user WHERE username='" + identifiant + "' OR phoneNumber='" + identifiant + "'", (error,result) => {
        res.send(result)
    })
})

app.post("/diariko/logIn", (req,res) => {
    const {identifiant,password} = req.body
    db.query("SELECT id,password FROM user WHERE (username='" + identifiant + "' OR phoneNumber='" + identifiant + "')", (error,result) => {
        if (result.length > 0) {
            if(bcrypt.compareSync(password, result[0].password)){
            }   
        }
    })
})

app.post("/diariko/user/setPhoto", (req,res) => {
    const {cookies, headers} = req
    const data = authTokenXsrf(cookies,headers)
    console.log(data)
    if(data.id !== null){
        const {Photo} = req.files
        let tmp = []
        let fileName = ""
        
        do {
            fileName = Random(100,false)
            db.query("SELECT userId FROM photo where fileName='" + fileName + "'", (error,result) => {
                tmp = result
            })
        } while (tmp.length > 0)
        fileName += ".png"
        Photo.name = fileName 
        db.query("INSERT INTO photo (fileName,userId,status,addAt) VALUES ('" + fileName + "','" + data.id +"',1,NOW())", (error,result) => {
            if(!error){
                db.query("UPDATE user SET profil='" + fileName + "' WHERE id='" + data.id + "'", (err,resul) => {
                    if(!err){
                        Photo.mv(`${__dirname}/upload/${Photo.name}`)
                    }
                })
                
            }
        })
    }
    
    if(data && data.state === "access token expired and renewed"){
        res.cookie('accessToken', data.newFullTokenXsrf.accessTokenXsrf.token, {
            httpOnly: true,
            secure: true,
            maxAge: (Token.access.expiresIn * 1000) // convert seconds to milliseconds
        })
    
        res.cookie('refreshToken', data.newFullTokenXsrf.refreshTokenXsrf.token, {
            httpOnly: true,
            secure: true,
            maxAge: (Token.refresh.expiresIn * 1000)
        })
        res.send({diarikoXsrf: {accessXsrf: data.newFullTokenXsrf.accessTokenXsrf.xsrf, refreshXsrf: data.newFullTokenXsrf.refreshTokenXsrf.xsrf}})
    }
})

app.post("/diariko/user/getPhoto", (req,res) => {
    const {cookies, headers} = req
    const data = authTokenXsrf(cookies,headers)
    let buffer = ""
    let diarikoXsrf = ""

    console.log(data)
    console.log(cookies)
    
    if(data.id !== null){
        db.query("SELECT profil FROM user WEHRE id='" + data.id + "'", (error,result) => {
            if (result.length > 0) {
                fs.readFile(__dirname + '/upload/' + result[0].profil, (error,buffer) => {
                    buffer = buffer.toString('base64')
                })    
            }
        })
    }

    if(data && data.state === "access token expired and renewed"){
        res.cookie('accessToken', data.newFullTokenXsrf.accessTokenXsrf.token, {
            httpOnly: true,
            secure: true,
            maxAge: (Token.access.expiresIn * 1000) // convert seconds to milliseconds
        })
    
        res.cookie('refreshToken', data.newFullTokenXsrf.refreshTokenXsrf.token, {
            httpOnly: true,
            secure: true,
            maxAge: (Token.refresh.expiresIn * 1000)
        })
        diarikoXsrf = {accessXsrf: data.newFullTokenXsrf.accessTokenXsrf.xsrf, refreshXsrf: data.newFullTokenXsrf.refreshTokenXsrf.xsrf}
    }

    res.send({diarikoXsrf: diarikoXsrf, buffer: buffer})
})

app.post("/diariko/test", (req,res) => {
    res.cookie("test","test cookie",{
        maxAge: 30000,
        httpOnly: true,
        secure: true
    })
    res.send("OK, ça marche")
})

app.listen(PORT,()=>console.info(`Server listen on port: ${PORT}`))