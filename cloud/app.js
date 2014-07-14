
// These two lines are required to initialize Express in Cloud Code.
var express = require('express');
var moment = require('moment');
var parseExpressHttpsRedirect = require('parse-express-https-redirect');
var parseExpressCookieSession = require('parse-express-cookie-session');
var app = express();


// Global app configuration section
app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'ejs');    // Set the template engine
app.use(parseExpressHttpsRedirect()); 
app.use(express.bodyParser());    // Middleware for reading request body

app.use(express.cookieParser('YOUR_SIGNING_SECRET'));
app.use(express.cookieSession());
app.use(parseExpressCookieSession({ cookie: { maxAge: 120000000 } }));
//app.use(express.cookieSession({secret:123}));

app.locals.username='';


// This is an example of hooking up a request handler with a specific request
// path and HTTP verb using the Express routing API.
app.get('/hello', function(req, res) {

	for(var i in req.session)
  		console.log(" var "+i+" is "+req.session[i]);
  
  res.render('hello', { message: 'Congrats, you just set up your app!' });
  
});

var objQuestions = Parse.Object.extend('Questions');
var objAnswers=Parse.Object.extend('Answers');
var matrix=new Array();
var matrixScore=new Array();
var questions;
//Array.prototype.sort=function(){return Math.random()-0.5;};

function returnQuestions(res,query,body,isScore,username,title,course){
	//var query = new Parse.Query(objQuestions);
	var score=0;
	//query.include('AnswerList').find().then(//{
	//query.find({
	 //query.exists("AnswerList").find().then(
	 query.ascending("ID").find().then(
		//success:function(results){
		function(results){ //results contiene la lista delle domande
			questions=results;
			console.log( "-- result class "+(results instanceof Array));
			//results.sort(function(){return Math.random()-0.5;});
			var answersQueryCount=0;
			results.forEach(function(record){ //scorre le domande record è la singola domanda
				/*
					console.log("-- MAIN QUERY id "+record.id+" - name "+record.get('Name')+" - list "+record.get('AnswerList').length);
			
					if(record.get("AnswerList").length>0)
						record.get("AnswerList").forEach(function (rec){
							console.log("--Answers rec "+rec.id);
						});			
				*/

				//console.log("-- MAIN QUERY id "+record.id+" - name "+record.get('Name')+" - list "+record.relation('Answers'));
						
				record.relation("Answers").query().find().then(function(answers){ //answers vettore risposte
					answersQueryCount++;
					answers.sort(function(){return Math.random()-0.5;});
					//answers.sort();
					matrix[record.id]=answers;
					//determino punteggio risposta
					var score=0;
					if(isScore){
						answers.forEach(function (ans){ // scorro risposte
							//console.log("--Answers rec "+ans.id);									
							if(body[record.id] && ans.get("ID")=='A' &&  body[record.id]==ans.id) score=1; //risposta corretta
							//else if(body[record.id] && body[record.id]==ans.id) score=-1;

						});//foreach
						//console.log("--isScore point "+score);
						matrixScore[record.id]=score;
					}
					//console.log("--get Answer Relation "+record.id)
					//if(results[results.length-1].id==record.id){
					if(answersQueryCount==results.length){
						var template='questions';
						var totalScore=0;
						//console.log("--matrixScore length "+matrixScore.length);
						for (var iScore in matrixScore){
						//matrixScore.forEach(function(iScore){
							//console.log("--caclulating score "+matrixScore[iScore]);
							totalScore+=matrixScore[iScore];
						}//);
						console.log("TotalScore = "+totalScore+" is score "+isScore);

						if(isScore) {
							template='answers';
							saveScore(totalScore,course).then(function(success){render();},function(error){console.log("SAVE FAILED");});							
						}
						else{
							//get novel
							new Parse.Query("Novels").equalTo("CourseId",course).find().then(function (texts){
								//render page
								render(texts);
							},function(error){
								res.send(500,"FAILED TO GET COURSES");
							});
							
						}

						function render(texts){
							res.render(template, { 
		 						number:results.length, 					
		      					questions:results,
								answers:matrix,
								isScore:isScore,
								body:body,
								//username:username,
								title:title,
								score:matrixScore,
								totalScore:totalScore,
								texts:texts
							});
						}
					}
					
					},function(error){
						res.send(500,"ERROR DURING RELATION QUERY ");
					}); //then		
		
		});

		//}, error: function (error){
		  },  function (error){
					res.send(500,"ERROR DURING MAIN QUERY ");
				}
	
		  );

}

function saveScore(score,course){
	var GameScore = Parse.Object.extend("Score");
	console.log("--looking for course "+course.id);
//	new Parse.Query("Courses").get(courseId,{success:function(rec){
//	new Parse.Query("Courses").get(courseId,{success:function(rec){
	//new Parse.Query("Courses").find({success:function(rec){
		//if(course){
			console.log("--course found ");
			var gameScore = new GameScore();
 			
			return gameScore.save({
		  		score: score,
		  		userId: Parse.User.current(),
		  		courseId: course		  		
				}, 
				{ 
					success: function(obj) {
			    // The object was saved successfully.
			    	console.log("--Update success");
			  	}, error: function(obj, error) {
			    // The save failed.
			    // error is a Parse.Error with an error code and description.
			    	console.log("--Update failed");
			 	 }
			});

		//} else console.log("--course NOT found ");
/*
	},error:function(error){
		console.log("--Error looking course");
	}}).then(function(res){console.log("--save finished");},function(error){});
*/
	
}

app.get('/questions/:id',function(req,res){
	if(Parse.User.current()){
		app.locals.username=req.session.username;
		var courseId=req.params.id;
		app.locals.courseId=courseId;
		new Parse.Query("Courses").get(courseId,{success:function(course){
			var q= new Parse.Query("Questions");
			q.equalTo("CourseId",course);
			returnQuestions(res,q,null,false,req.session.username,"Questions N°",course);
		},error:function(error){
			res.send(500,"Error getting questions")
		}});
	}
	else res.redirect('/login');
	
});

app.post('/questions/:courseId', function(req,res){
	var result="";
	//req.body.forEach(function(record){result+=record+" ";});
	var keys=[];
	var score=0;
	for (var i in req.body ) { 
		keys.push(i); result+=" name "+ i+" value "+req.body[i];
	}
	console.log("JSON "+JSON.stringify(req.body));
	//res.render('hello',{message: result});
	/****
	Parse.User.current().fetch({success:function(user){
		//currentUsername=user.getUsername();		
		console.log("--currentusername inside= "+currentUsername);
		//console.log("--currentusername= "+currentUsername);
		returnQuestions(res,req.body,true,currentUsername,"Your score is ");
	},
	error:function(error){}})
**********/
	if(Parse.User.current()){
		var courseId=req.params.courseId;
		app.locals.username=req.session.username;
		app.locals.courseId=courseId;
		console.log("--currentusername inside= "+req.session.username);	
		new Parse.Query("Courses").get(courseId,{success:function(course){
				var q= new Parse.Query("Questions");
				q.equalTo("CourseId",course);	
				returnQuestions(res,q,req.body,true,'',"Your score is ",course);
			}, error: function(error){
				res.send(500,"Error queryng courses")
			}
		});
	}else res.redirect("/login");
});
/*****NOT USED ANYMORE
app.get('/questions', function(req,res){
	console.log("/questions called");
	if(Parse.User.current()){
		console.log("--VALID USER");		
		Parse.User.current().fetch().then(function(u){					
				//console.log("---username "+u.getUsername());
				//req.session.username=u.getUsername();
				app.locals.username=req.session.username;
				//currentUsername=u.getUsername();
				returnQuestions(res,new Parse.Query('Questions'),null,false,u.getUsername(),"Questions N°");
			},
			function(error){
				res.send(500,"user fetch failed");
			});		
	}
	else {
		//res.send(500,"user not valid");
		console.log("--user not valid");
		res.redirect("/login");
	}
	

});
//TODO sistemare il parametro
/****
app.post('/questions', function(req,res){
	var result="";
	//req.body.forEach(function(record){result+=record+" ";});
	var keys=[];
	var score=0;
	for (var i in req.body ) { 
		keys.push(i); result+=" name "+ i+" value "+req.body[i];
	}
	console.log("JSON "+JSON.stringify(req.body));
	//res.render('hello',{message: result});
	/****
	Parse.User.current().fetch({success:function(user){
		//currentUsername=user.getUsername();		
		console.log("--currentusername inside= "+currentUsername);
		//console.log("--currentusername= "+currentUsername);
		returnQuestions(res,req.body,true,currentUsername,"Your score is ");
	},
	error:function(error){}})
**********/
/**rimuovere
	app.locals.username=req.session.username;
	console.log("--currentusername inside= "+req.session.username);
	new Parse.Query("Courses").get(courseId,{success:function(course){
			var q= new Parse.Query("Questions");
			q.equalTo("CourseId",course);	
			returnQuestions(res,q,req.body,true,'',"Your score is ");
		}, error: function(error){
			res.send(500,"Error queryng courses")
		}
});
******/
app.get('/courses', function(req,res){
	if(Parse.User.current()){
		app.locals.username=req.session.username;
		var q=new Parse.Query("Courses");
		q.find(
		{
			success:function(result){
				console.log("---courses render");
				res.render('courses',{courses:result});
				console.log("---courses rendered");
			},
			error:function(error){
				res.send(500, "Error during query on courses");
			}
		});
	}
	else res.redirect('/login');
});

app.post('/courses',function(req,res){
	//app.locals.course=req.body.course;
	//res.session.course=req.body.course;
	if(Parse.User.current())	res.redirect('/questions/'+req.body.course);
	else  res.redirect('/login');
});

app.get('/', function(req,res){
  res.redirect("/courses");
}); //app get


// // Example reading from the request query string of an HTTP get request.
// app.get('/test', function(req, res) {
//   // GET http://example.parseapp.com/test?message=hello
//   res.send(req.query.message);
// });

// // Example reading from the request body of an HTTP post request.
// app.post('/test', function(req, res) {
//   // POST http://example.parseapp.com/test (with request body "message=hello")
//   res.send(req.body.message);
// });

app.post('/hello', function(req,res){
	res.render('hello',{message: req.body.message});
});

app.get("/logout",function(req,res){
	Parse.User.logOut();
	res.redirect("/login");
});

app.get("/login",function(req,res){
	res.render("login")
});
app.post('/login',function(req,res){
	console.log(req.body.username+" "+req.body.password);
	/*
	Parse.User.setUsername(req.body.username);
	Parse.User.setPassword(req.body.password);
	*/
	Parse.User.logIn(req.body.username,req.body.password).then(function(user){
		/*
		req.session.username="CIAOOOO";
		for(var i in req.session)
			console.log (" key "+i+" in "+req.session[i]);
		*/
		req.session.username=user.get('username');		
		res.redirect('/courses');
	},function(error){
		res.send(500, "login failed");
	});
});

app.post('/signup',function(req,res){
	console.log(req.body.username+" "+req.body.password+" "+req.body.mail);
	/*
	Parse.User.setUsername(req.body.username);
	Parse.User.setPassword(req.body.password);
	*/
	Parse.User.signUp(req.body.username,req.body.password,{email:req.body.mail}).then(function(user){
		req.session.username=user.get('username');		
		res.redirect('/courses');
	},function(error){
		res.send(500, "sgnup login failed");
	});
});
/*
function getMinimumDate(q){
	return query.first().find({success:function(result){			
			var minDate=result.createdAt;			
			console.log("--minDate 11 - "+moment(minDate).format('Do/MM'));	
			afterMin(minDate);
	},error: function(error){
			res.send(500,"error getting last date");
	}});
}
*/
app.post('/chart',function(req,res){
	if(!Parse.User.current()) {
		res.redirect("/login");
		return;
	}
	app.locals.username=req.session.username;
	var Score=Parse.Object.extend("Score");
	//getminimum date
	//var minDate;
	var x=[];
	var y=[];
	var ord=[];



	var query=new Parse.Query(Score);
	query.ascending('createdAt');
	query.equalTo('userId',Parse.User.current());
	query.exists('courseId');
	//minima data
	query.first().then(function(firstScore){	
		var minDate=firstScore.createdAt;			
		//
		console.log("--minDate 1 - "+moment(minDate).format('Do/MM'));
		//preparo asse ascisse con le date
		var firstDate=moment(minDate).subtract('days',1);
		console.log("--firstDate "+moment(firstDate).format('Do/MM'));
		//calcolo giorni tra oggi e firstDate
		var days=moment().add('days',2).diff(firstDate,'days')+1;
		console.log("--difference date "+days);
		//carico array ascisse
		for(var i=0;i<days;i++) x.push(moment(firstDate).add('days',i).format('Do/MM'));
		//recupero lista dei corsi
		//new Parse.Query("Courses").find({success:function(courses){
		var gCourses;
		new Parse.Query("Courses").find().then(function(courses){
			gCourses=courses;
			console.log("Courses query found looping");
			var arrQuery=[];
			var promise = Parse.Promise.as();
		    courses.forEach(function(course){			
				y[course.id]=[];
				//inizializzo la matrice ordinate
				for(var i=0;i<days;i++) y[course.id][moment(firstDate).add('days',i).format('Do/MM')]=0;
				//per ogni corso calcolo il punteggio			
				query.equalTo('courseId',course);
				//console.log("Score query calling");
				arrQuery.push(query);
				console.log("--start promise");
				promise=promise.then(function(){
					console.log("--promise then 1");
					var query2=new Parse.Query(Score);
					query2.ascending('createdAt');
					query2.equalTo('userId',Parse.User.current());
					query2.equalTo('courseId',course);
					return query2.find();
				}).then(function(scores){
					console.log("--promise then 2");
					console.log("score for courseId found"+course.id);
					scores.forEach(function(rec){
						//console.log("found score "+rec.get('score'));
						y[course.id][moment(rec.createdAt).format('Do/MM')]=rec.get('score');					
					});
					//console.log("--output y "+JSON.stringify(y[course.id]));
					
					var i=0;
					for(var d in y){
						//asc+="'"+d+"',";
						//ord+=y[d]+",";
						//asc.push(d);
						//console.log("--KEY "+d);
						ord[i]=[];
						for(k in y[d])
							ord[i].push(y[d][k]);
						i++;
					}


					console.log("--output ord "+JSON.stringify(ord));
					
				},function(error){console.log("--error during query");});
				
		    console.log("--end loop");	
			});	
			console.log("--return promise");
		    return promise;		

    	 
		},function(error){
			res.send(500, "Error getting courses");
		}).then(function(succ){
			console.log("--last then");
			res.render('chart',{
				series:ord,
				ticks: x,
				courses:gCourses						
			});
		});
	});
	
});

app.get('/chart2',function(req,res){
	var y=[],x=[];
	//carico array ascisse
	//for(var i=0;i<days;i++) x.push(moment(firstDate).add('days',i).format('Do/MM'));
	new Parse.Query("Courses").find().then(function(courses){
		console.log("Courses query found looping");		
		
		var promise = Parse.Promise.as();

	    courses.forEach(function(course){			
			y[course.id]=[];												
			console.log("--start promise");
			///promise=promise.then(function(){
			promise=promise.then(function(){
				console.log("--promise then 1");
				var query2=new Parse.Query("Score");
				query2.ascending('createdAt');
				query2.equalTo('userId',Parse.User.current());
				query2.equalTo('courseId',course);
				return 	query2.find();//.then(function(scores){
			}).then(function(scores){
					console.log("--promise then 2");
					console.log("score for courseId found"+course.id);
					scores.forEach(function(rec){
						console.log("found score "+rec.get('score'));
						y[course.id][moment(rec.createdAt).format('Do/MM')]=rec.get('score');
					});
				},function(error){console.log("--error during query");}
			);
			console.log("--end loop");
		});//foreach
	console.log("--return promise");
	return promise;	
	
	}).then(function(){//query courses
		console.log("--last then");
		res.render('chart',{
			series:y,
			ticks: x	
		});
	});
});

// Attach the Express app to Cloud Code.
app.listen();
