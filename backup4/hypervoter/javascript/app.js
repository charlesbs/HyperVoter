'use strict';

var express = require('express');
var path = require('path');
var session = require('express-session');
var bodyParser = require('body-parser');
var nodemailer = require('nodemailer');
// var crypto = require('crypto');

const date = require('date-and-time');
let votestart = false;
let endTime = new Date();
const FabricCAServices = require('fabric-ca-client');

const {FileSystemWallet, Gateway, X509WalletMixin} = require('fabric-network');
const fs = require('fs');

const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

// date time
// const date = require('date-and-time');
// let votestart = false;
// let endTime = new Date();

var app = express();
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.engine('html', require('ejs').renderFile); 

let currVoteId = -1;

//Enroll Admin if Not already installed
async function main() {
    try{
            // Create a new CA client for interacting with the CA.
            const caURL = ccp.certificateAuthorities['ca.example.com'].url;
            const ca = new FabricCAServices(caURL);

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (adminExists) {
                console.log('An identity for the admin user "admin" already exists in the wallet');
                console.log('Please continue');
                return;
            }

            // Enroll the admin user, and import the new identity into the wallet.
            const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
            const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            wallet.import('admin', identity);
            console.log('Successfully enrolled admin user "admin" and imported it into the wallet');
        

    } catch (error){
        console.log(`Failed to enroll admin user "admin": ${error}`);
        console.log('Please run enrollAdmin.js in a seperate terminal window before continuing!\n');
    }
};

app.get('/', function(request, response) {
    request.session.loggedin = false;
	response.sendFile(path.join(__dirname + '/public/index.html'));
});

app.get('/EC-dashboard/index.html', function(request, response) {
	response.sendFile(path.join(__dirname + '/public/EC-dashboard/index.html'));
});

app.get('/testing.html', function(request, response) {
    let a = [{"voterId":"101","pin":"978"},{"voterId":"102","pin":"336"},{"voterId":"103","pin":"132"},{"voterId":"104","pin":"352"},{"voterId":"105","pin":"375"}];
	response.send(a);
});

app.get('/EC-dashboard/ec-login.html', function(request, response) {
	response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-login.html'));
});

app.get('/EC-dashboard/ec-registration.html', function(request, response) {
	response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-registration.html'));
});

app.post('/EC-dashboard/EC-lgin', function(request, response) {
    var username = request.body.username;
    var password = request.body.password;
    if (username && password) {
        if (username == 1) {
            if (password == 54321) {
                request.session.loggedin = true;
                request.session.username = username;
            } else {
                console.log('Incorrect EC username!');
                response.redirect('/EC-dashboard/ec-login.html');
            }
        } else {
            console.log('Incorrect EC password!');
            response.redirect('/EC-dashboard/ec-login.html');
        }
    } else {
        console.log('Please enter Username and Password!');
        response.redirect('/EC-dashboard/ec-login.html');
    }
    console.log("Credentials verified, loggin the EC in!");
    response.redirect('/EC-dashboard/ec-dashboard.html');
    response.end();
});

app.post('/EC-dashboard/EC-reg', function(request, response) {
    var username = request.body.username;
    var password = request.body.password;
    if (username && password) {
        if (username == 1) {
            if (password == 54321) {
                request.session.loggedin = true;
                request.session.username = username;
            } else {
                console.log('Incorrect EC username!');
                response.redirect('/EC-dashboard/ec-registration.html');
            }
        } else {
            console.log('Incorrect EC password!');
            response.redirect('/EC-dashboard/ec-registration.html');
        }
    } else {
        console.log('Please enter Username and Password!');
        response.redirect('/EC-dashboard/ec-registration.html');
    }
    console.log("Credentials verified, Registering EC account!");

    if (request.session.loggedin) {
        async function registerEC() {
            let EC_ID = '1';
            try{
                // Create a new file system based wallet for managing identities.
                const walletPath = path.join(process.cwd(), 'wallet');
                const wallet = new FileSystemWallet(walletPath);
                console.log(`Wallet path: ${walletPath}`);    
                
                // Check to see if we've already enrolled the EC.
                const EC_Exists = await wallet.exists(EC_ID);
                if (EC_Exists) {
                    console.log(`An identity for the EC already exists in the wallet`);
                    response.redirect('/EC-dashboard/index.html');
                    return;
                }

                // Check to see if we've already enrolled the admin user.
                const adminExists = await wallet.exists('admin');
                if (!adminExists) {
                    console.log('An identity for the admin user "admin" does not exist in the wallet');
                    console.log('Run the enrollAdmin.js application before retrying');
                    response.redirect('/');
                    return;
                }

                // Create a new gateway for connecting to our peer node.
                const gateway = new Gateway();
                await gateway.connect(ccp, {wallet, identity: 'admin', discovery: {enabled: false}});

                // Get the CA client object from the gateway for interacting with the CA.
                const ca = gateway.getClient().getCertificateAuthority();
                const adminIdentity = gateway.getCurrentIdentity();

                // Register the user, enroll the user, and import the new identity into the wallet.
                const secret = await ca.register({
                    affiliation: 'org1.department1',
                    enrollmentID: EC_ID,
                    role: 'client'
                }, adminIdentity);

                const enrollment = await ca.enroll({enrollmentID: EC_ID, enrollmentSecret: secret});
                const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
                wallet.import(EC_ID, userIdentity);
                console.log(`Successfully registered and enrolled EC with enrollment ID 1 and imported it into the wallet`);

            } catch (error) {
                console.log(`Failed to register EC: ${error}`);
                response.redirect('/');
                // response.end();
                // process.exit(1);    
            }
        }
        registerEC();
    }
    response.redirect('/EC-dashboard/ec-dashboard.html');
});

app.get('/EC-dashboard/ec-dashboard.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-dashboard.html'));
});

app.get('/EC-dashboard/ec-dashboard', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-dashboard.html'));
});

app.get('/EC-dashboard/ec-dashboard-add-voter.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-dashboard-add-voter.html'));
});

var curr_voter_id = 100; //Global current voter id for sequential allocation

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function random_pin(min, max) {  
    return Math.floor(
      Math.random() * (max - min) + min
    )
}


app.post('/EC-dashboard/EC-addNewVoter', function(request, response) {
    // var voter_id = request.body.newVoterID;
    // var voter_pin = request.body.newVoterPIN;
    var voter_email = request.body.newVoterEmail;
    curr_voter_id = curr_voter_id + 1;
    let voter_id = curr_voter_id.toString();
    var voter_pin = random_pin(111, 999).toString();

    // var voter_pin_hashed = crypto.createHash('sha256').update(voter_pin.toString()).digest('base64');

    //  START - Reading Voters List and Writing to it
    let rawdata_voters = fs.readFileSync('voters.json');
    let voters_list = JSON.parse(rawdata_voters);
    //console.log(voters_list);
    let voterId;
    var new_voter_json = { "voterId" : voter_id, "pin" : voter_pin};
    voters_list.push(new_voter_json);
    let new_voters_list = JSON.stringify(voters_list);
    fs.writeFileSync('voters.json', new_voters_list);
    //  END - Reading Voters List and Writing to it
    currVoteId +=1;

    if (voter_email) {
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'ec.hypervoter@gmail.com',
              pass: 'blockchain'
            }
          });
          
          var mailOptions = {
            from: 'ec.hypervoter@gmail.com',
            to: voter_email,
            subject: 'Voter Details for HyperVoter Elections',
            text: 'Hello Voter,\nYour Voting details for the upcoming HyperVoter elections are as follows: \n\n' + 'Voter ID: ' + voter_id + '\nVoter PIN: ' + voter_pin + '\nVote ID: ' + currVoteId + '\n',
          };
          
          transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
    };

    // Creating Corresponding Vote Object

    if (request.session.loggedin){
        if (request.session.username == 1) {
            async function createVoteObj(){
                let userId = '1';
                try{
                    // Create a new file system based wallet for managing identities.
                    const walletPath = path.join(process.cwd(), 'wallet');
                    const wallet = new FileSystemWallet(walletPath);
                    console.log(`Wallet path: ${walletPath}`);

                    // Check to see if we've already enrolled the user.
                    const userExists = await wallet.exists(userId);
                    if (!userExists) {
                        console.log(`An identity for the EC ${userId} does not exist in the wallet`);
                        response.redirect('/EC-dashboard/index.html');
                        return;
                    }

                    // Create a new gateway for connecting to our peer node.
                    const gateway = new Gateway();
                    await gateway.connect(ccp, {wallet, identity: userId, discovery: {enabled: false}});

                    // Get the network (channel) our contract is deployed to.
                    const network = await gateway.getNetwork('mychannel');

                    // Get the contract from the network.
                    const contract = network.getContract('fabchat');

                    let sendTo = voter_id;

                    await contract.submitTransaction('createVoteObj', sendTo);
                    console.log("Added Voter and created VOTE Obj successfully!\n");

                    await gateway.disconnect();

                } catch (error) {
                    console.log(`Failed to submit transaction: ${error}`);
                    //response.redirect('/EC-dashboard/ec-dashboard.html');
                    process.exit(1);
                }
            }
            createVoteObj();
        }
    }
    response.redirect('/EC-dashboard/ec-dashboard-add-voter.html');
});

app.get('/EC-dashboard/ec-dashboard-add-candidate.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-dashboard-add-candidate.html'));
});

app.get('/EC-dashboard/ec-set-time.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-set-time.html'));
});

app.post('/EC-dashboard/set-time', function(request, response) {
    var duration = request.body.duration;
    const now = new Date();
    //const Indian = new Date(now.getTime()+ 3600000*5.5);
    endTime = date.addMinutes(now, parseInt(duration));

    async function setTime(){
        let userId = '1';
        try{
            
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(userId);
            if (!userExists) {
                console.log(`An identity for the EC ${userId} does not exist in the wallet`);
                response.redirect('/EC-dashboard/index.html');
                return;
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {wallet, identity: userId, discovery: {enabled: false}});

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('fabchat');

            let endTimeString = endTime.toString();

            await contract.submitTransaction('setEndTime', endTimeString);
            console.log(`Setting End Time To: ${endTime}`);
            votestart = true;
            console.log("Voting End Time set Successfully!\n");

            await gateway.disconnect();

        } catch (error) {
            console.log(`Failed to submit transaction: ${error}`);
            //response.redirect('/EC-dashboard/ec-dashboard.html');
            process.exit(1);
        }
    }
    setTime();

    let outString = "Voting End Time Set to: "+ endTime.toString();
    response.render(__dirname+"/public/EC-dashboard/ec-set-time.html", {_:outString});
});


app.post('/EC-dashboard/home-page', function(request, response) {
    request.session.loggedin = false;
    response.redirect('/'); 
});

app.post('/voter-dashboard/home-page', function(request, response) {
    request.session.loggedin = false;
    response.redirect('/'); 
});

app.post('/public-bulletin/home-page', function(request, response) {
    request.session.loggedin = false;
    response.redirect('/'); 
});

app.post('/public-bulletin/public-bulletin/home-page', function(request, response) {
    request.session.loggedin = false;
    response.redirect('/'); 
});

app.post('/home-page', function(request, response) {
    request.session.loggedin = false;
    response.redirect('/'); 
});

app.post('/EC-dashboard/EC-addNewCandidate', function(request, response) {
    var candidate_id = request.body.newCandidateID;
    var candidate_name = request.body.newCandidateName;

    //  START - Reading Candidates List and Writing to it
    let rawdata_c = fs.readFileSync('candidates.json');
    let c_list = JSON.parse(rawdata_c);
    var new_c_json = {
        "candidateId" : candidate_id,
        "name" : candidate_name
    };
    c_list.push(new_c_json);
    let new_c_list = JSON.stringify(c_list);
    fs.writeFileSync('candidates.json', new_c_list);
    //  END - Reading candidates List and Writing to it
    response.redirect('/EC-dashboard/ec-dashboard-add-candidate.html');
});

app.get('/voter-dashboard/index.html', function(request, response) {
	response.sendFile(path.join(__dirname + '/public/voter-dashboard/index.html'));
});

app.get('/voter-dashboard/voter-login.html', function(request, response) {
	response.sendFile(path.join(__dirname + '/public/voter-dashboard/voter-login.html'));
});

app.get('/voter-dashboard/voter-registration.html', function(request, response) {
	response.sendFile(path.join(__dirname + '/public/voter-dashboard/voter-registration.html'));
});

app.post('/voter-dashboard/voter-lgin', function(request, response) {
    var username = request.body.username;
    var password = request.body.password;

    let rawdata_voters = fs.readFileSync('voters.json');
    let voters_list = JSON.parse(rawdata_voters);

    let flag = 0;

    if (username && password) {
        // var voter_pin_hashed = crypto.createHash('sha256').update(password.toString()).digest('base64');
        for (let i = 0; i<voters_list.length; i++){
            if (voters_list[i].voterId == username){
                flag = 1;
                if (voters_list[i].pin != password){
                    console.log("Incorrect PIN");
                    response.send('Incorrect Pin, go back and try again!');
                    break;
                } else {
                    console.log("Identity Verified!\n");
                    request.session.loggedin = true;
                    request.session.username = username;
                    break;
                }
            }
        }

        if (flag != 1){
            console.log("You have not been pre-approved by EC to register as a voter!");
            response.redirect('/');
        }
        response.redirect('/voter-dashboard/voter-dashboard.html');
        response.end();
    }
});

app.post('/voter-dashboard/voter-reg', function(request, response){
    var username = request.body.username;
    var password = request.body.password;

    let flag = '0';

    let rawdata_voters = fs.readFileSync('voters.json');
    let voters_list = JSON.parse(rawdata_voters);

    if (username && password) {
        // var voter_pin_hashed = crypto.createHash('sha256').update(password.toString()).digest('base64');
        for (let i = 0; i<voters_list.length; i++){
            if (voters_list[i].voterId == username){
                flag = 1;
                if (voters_list[i].pin != password){
                    console.log("Incorrect PIN");
                    response.send('Incorrect Pin, go back and try again!');
                    break;
                } else {
                    console.log("Identity Verified!\n");
                    request.session.loggedin = true;
                    request.session.username = username;
                    break;
                }
            }
        }

        if (flag != 1){
            console.log("You have not been pre-approved by EC to register as a voter!");
            response.redirect('/voter-dashboard/voter-registration.html');
        }
        console.log("Credentials verified, Registering voter account!");
        if(request.session.loggedin) {
            async function registerVoter(){
                try{
                    let voter = username;
                    // Create a new file system based wallet for managing identities.
                    const walletPath = path.join(process.cwd(), 'wallet');
                    const wallet = new FileSystemWallet(walletPath);
                    console.log(`Wallet path: ${walletPath}`);

                    // Check to see if we've already enrolled the user.
                    const voterExists = await wallet.exists(voter);
                    if (voterExists) {
                        console.log(`An identity for the voter ${voter} already exists in the wallet`);
                        response.redirect('/voter-dashboard/voter-login.html');
                    }

                    // Check to see if we've already enrolled the admin user.
                    const adminExists = await wallet.exists('admin');
                    if (!adminExists) {
                        console.log('An identity for the admin user "admin" does not exist in the wallet');
                        console.log('Run the enrollAdmin.js application before retrying');
                        response.redirect('/');
                        return;
                    }

                    // Create a new gateway for connecting to our peer node.
                    const gateway = new Gateway();
                    await gateway.connect(ccp, {wallet, identity: 'admin', discovery: {enabled: false}});

                    // Get the CA client object from the gateway for interacting with the CA.
                    const ca = gateway.getClient().getCertificateAuthority();
                    const adminIdentity = gateway.getCurrentIdentity();

                    // Register the user, enroll the user, and import the new identity into the wallet.
                    const secret = await ca.register({
                        affiliation: 'org1.department1',
                        enrollmentID: voter,
                        role: 'client'
                    }, adminIdentity);
                    const enrollment = await ca.enroll({enrollmentID: voter, enrollmentSecret: secret});
                    const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
                    wallet.import(voter, userIdentity);
                    console.log(`Successfully registered and enrolled voter ${voter} and imported it into the wallet`);
                } catch (error) {
                    console.log(`Failed to register voter: ${error}`);
                    response.redirect('/voter-dashboard/index.html');
                    // process.exit(1); 
                }
            }
        registerVoter();
        }
        response.redirect('/voter-dashboard/voter-dashboard.html');
    }
});

app.get('/voter-dashboard/voter-dashboard.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/voter-dashboard/voter-dashboard.html'));
});

app.get('/public-bulletin/index.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/public-bulletin/index.html'));
});

app.post('/voter-dashboard/voting', function(request, response){
    var username = request.session.username;
    var password = request.body.password;
    var candidate = request.body.candidate;
    let userId = username;
    let r = '1';

    if(request.session.loggedin){
        if(request.session.username != 1){
            async function sendVoteObj(){
                try{
                    const now = new Date();
                    const Indian = new Date(now.getTime()+ 3600000*5.5);
                    if (votestart!=true){
                        r = '0';
                    } 
                    if (now>endTime){
                        r = '0';
                    }

                    const walletPath = path.join(process.cwd(), 'wallet');
                    const wallet = new FileSystemWallet(walletPath);
                    console.log(`Wallet path: ${walletPath}`);

                    // Check to see if we've already enrolled the user.
                    const userExists = await wallet.exists(userId);
                    if (!userExists) {
                        console.log(`An identity for the ${userId} does not exist in the wallet`);
                        response.redirect('/');
                    }

                    // Create a new gateway for connecting to our peer node.
                    const gateway = new Gateway();
                    await gateway.connect(ccp, {wallet, identity: userId, discovery: {enabled: false}});

                    // Get the network (channel) our contract is deployed to.
                    const network = await gateway.getNetwork('mychannel');

                    // Get the contract from the network.
                    const contract = network.getContract('fabchat');

                    let sendTo = candidate;
                    const curr_time = new Date();
                    let curr_time_string = curr_time.toString();

                    
                    if (r == '0'){
                        console.log("Voting had ended! You can no longer cast your vote!\n");
                    } else {
                        await contract.submitTransaction('sendVoteObj', userId, sendTo);
                        console.log("Vote Casted successfully!\n");
                    }
                    
                    await gateway.disconnect();
                    //response.write(voteInfo);

                } catch (error){
                    console.log(`Failed to submit transaction: ${error}`);
                }
            }
            sendVoteObj();
        }
    }
    console.log('testing');
    // response.redirect('/'); 
    if (r == '0'){
        response.redirect('/v_ended'); 
    } else {
        response.redirect('/thankyou'); 
    }
});

app.get('/thankyou', function(request, response) {
    request.session.loggedin = false;
    response.sendFile(path.join(__dirname + '/public/public-bulletin/thankyou_forvoting.html'));
});

app.get('/v_ended', function(request, response) {
    request.session.loggedin = false;
    response.sendFile(path.join(__dirname + '/public/public-bulletin/voting_ended.html'));
});

app.get('/public-bulletin/public-bulletin/queryAllVotes.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/public-bulletin/queryAllVotes.html'));
});

app.get('/public-bulletin/queryAllVotes.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/public-bulletin/queryAllVotes.html'));
});

app.get('/public-bulletin/public-bulletin/results.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/public-bulletin/results.html'));
});

app.get('/public-bulletin/results.html', function(request, response) {
    response.sendFile(path.join(__dirname + '/public/public-bulletin/results.html'));
});

app.post('/voter-dashboard/get-can', function(request, response){
    let rawdata_c = fs.readFileSync('candidates.json');
    let c_list = JSON.parse(rawdata_c);

    let candidates_string = "";

    for (let i = 0; i<c_list.length; i++){
        let temp = "Candidate Name: "+c_list[i].name +"    , Candidate ID: "+c_list[i].candidateId+"<br></br>";
        candidates_string+=temp;
    }

    response.render(__dirname + "/public/voter-dashboard/voter-dashboard.html", {_:JSON.stringify(candidates_string)});
    // response.send(c_list);
});

app.post('/public-bulletin/get-result', function(request, response){
    async function getResults(){
        try {
            let userId = '1';
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(userId);
            if (!userExists) {
                console.log(`An identity for the ${userId} does not exist in the wallet`);
                response.redirect('/');
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {wallet, identity: userId, discovery: {enabled: false}});

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('fabchat');

            let results = await contract.submitTransaction('getResults');
            results = JSON.parse(results.toString('utf8'));

            // results.forEach(function(data){
            //     console.log(data.name);
            // });

            let resultString = "";

            for (let i = 0; i<results.length; i++){
                let temp = "Candidate ID: "+ (results[i].candidateId) + "    , Vote Count: "+ results[i].voteCount+"<br></br>";
                resultString+=temp;
            }

            // document.getElementById("result").innerHTML=results;
            response.render(__dirname + "/public/public-bulletin/results.html", {_:JSON.stringify(resultString)});
            await gateway.disconnect();
            // response.send(results);
            //response.redirect('/');

        } catch (error) {
            console.log(`Failed to get Results: ${error}`);
            //response.redirect('/');
        }
    }
    getResults();
});

app.post('/public-bulletin/public-bulletin/get-result', function(request, response){
    async function getResults(){
        try {
            let userId = '1';
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(userId);
            if (!userExists) {
                console.log(`An identity for the ${userId} does not exist in the wallet`);
                response.redirect('/');
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {wallet, identity: userId, discovery: {enabled: false}});

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('fabchat');

            let results = await contract.submitTransaction('getResults');
            results = JSON.parse(results.toString('utf8'));

            // results.forEach(function(data){
            //     console.log(data.name);
            // });

            let resultString = "";

            for (let i = 0; i<results.length; i++){
                let temp = "Candidate ID: "+ (results[i].candidateId) + "    , Vote Count: "+ results[i].voteCount+"<br></br>";
                resultString+=temp;
            }

            // document.getElementById("result").innerHTML=results;
            response.render(__dirname + "/public/public-bulletin/results.html", {_:JSON.stringify(resultString)});
            await gateway.disconnect();
            // response.send(results);
            //response.redirect('/');

        } catch (error) {
            console.log(`Failed to get Results: ${error}`);
            //response.redirect('/');
        }
    }
    getResults();
});

main();

var server = app.listen(4001, function () {
  var host = 'localhost'
  var port = server.address().port
  
  console.log("Example app listening at http://%s:%s", host, port)
})
