//Author: Oliver Sjostrand
//Email: Oliver.Sjostrand@hotmail.se
//
//This is an API that returns JSON-formatted hastags based on location.
//URL query is in the format /events?lat="LATITUDE"&lng="LONGITUDE"&distance="DISTANCE"
//Example:
//http://localhost:3000/events?lat=51.5074247&lng=-0.1283064&distance=1000


var express = require('express');
var router = express.Router();
var Promise = require("bluebird");
var rp = require('request-promise');
var AlchemyAPI = require('./alchemyapi');
var alchemyapi = new AlchemyAPI();


function calculateStarttimeDifference(currentTime, dataString) {
    return (new Date(dataString).getTime() - (currentTime * 1000)) / 1000;
}
//Compares the popularity of two Facebook events.
function comparePopularity(a, b) {
    if ((a.eventStats.attendingCount + (a.eventStats.maybeCount / 2)) < (b.eventStats.attendingCount + (b.eventStats.maybeCount / 2)))
        return 1;
    if ((a.eventStats.attendingCount + (a.eventStats.maybeCount / 2)) > (b.eventStats.attendingCount + (b.eventStats.maybeCount / 2)))
        return -1;
    return 0;
}
//Compares the distance of two FacebookEvents
function compareDistance(a, b) {
    var aEventDistInt = parseInt(a.eventDistance, 10);
    var bEventDistInt = parseInt(b.eventDistance, 10);
    if (aEventDistInt < bEventDistInt)
        return -1;
    if (aEventDistInt > bEventDistInt)
        return 1;
    return 0;
}
//algorithm to calculate the distance between two coordinates
function haversineDistance(coords1, coords2, isMiles) {
    //coordinate is [latitude, longitude]
    function toRad(x) {
        return x * Math.PI / 180;
    }

    var lon1 = coords1[1];
    var lat1 = coords1[0];

    var lon2 = coords2[1];
    var lat2 = coords2[0];

    var R = 6371; // km

    var x1 = lat2 - lat1;
    var dLat = toRad(x1);
    var x2 = lon2 - lon1;
    var dLon = toRad(x2)
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;

    if (isMiles) d /= 1.60934;

    return d;
}
router.get('/', function(req, res, next) {
    res.json({
        "message": "Welcome to the Hashtag Generator"
    });
});

router.get('/events', function(req, res, next) {

    //If the parameter for the accesstoken is empty, use this token instead.
    if (!req.query.access_token) {
        //Facebook Graph api token
        req.query.access_token = "XXXXXXX";
    }

    if (!req.query.lat || !req.query.lng || !req.query.distance) {
        res.status(500).send({
            error: "Please specify the lat, lng, and distance, Facebook accesstoken is optional"
        });
    } else {

        var idLimit = 50, //FB only allows 50 ids per call
            currentTimestamp = (new Date().getTime() / 1000).toFixed(),
            venuesCount = 0,
            venuesWithEvents = 0,
            eventsCount = 0;

        var hashtags = {
            entity: []
        };

        //Builds the request string with the specified coordinates and search distance.
        var placeUrl = "https://graph.facebook.com/v2.5/search?type=place&q=*&center=" + req.query.lat + "," + req.query.lng + "&distance=" + req.query.distance + "&limit=1000&fields=id&access_token=" + req.query.access_token;

        console.log(placeUrl);

        //Get places as specified.
        rp.get(placeUrl).then(function(responseBody) {

                var ids = [],
                    tempArray = [],
                    data = JSON.parse(responseBody).data;

                //Set venueCount
                venuesCount = data.length;

                //Create array of 50 places each
                data.forEach(function(idObj, index, arr) {
                    tempArray.push(idObj.id);
                    if (tempArray.length >= idLimit) {
                        ids.push(tempArray);
                        tempArray = [];
                    }
                });

                // Push the remaining places
                if (tempArray.length > 0) {
                    ids.push(tempArray);
                }
                console.log("Number of place requests: " + ids.length);
                return ids;
            }).then(function(ids) {

                var urls = [];

                //Create a new Graph API request array to get the events on every given location.
                ids.forEach(function(idArray, index, arr) {
                    //Fetches events from location id where within the time span .since(unixtime - 1 week) .until(unixtime + 1 hour)
                    urls.push(rp.get("https://graph.facebook.com/v2.5/?ids=" + idArray.join(",") + "&fields=id,name,cover.fields(id,source)" +
                        ",location,events.fields(id,name,cover.fields(id,source),description,start_time,end_time,attending_count,declined_count,maybe_count,noreply_count)" +
                        ".since(" + (currentTimestamp - 604800) + ").until(" + (new Date().getTime() / 1000 + 3600).toFixed() + ")&access_token=" + req.query.access_token));
                });
                return urls;

            }).then(function(promisifiedRequests) {
                //Run Graph API requests in parallel
                return Promise.all(promisifiedRequests)

            })
            .then(function(results) {

                var events = [];
                var eventsDescription = [];


                //Build an array with the results
                results.forEach(function(resStr, index, arr) {
                    var resObj = JSON.parse(resStr);
                    Object.getOwnPropertyNames(resObj).forEach(function(venueId, index, array) {
                        var venue = resObj[venueId];

                        //add closest city and venue name.
                        if (hashtags.entity.length == 0) {
                            var city = "#" + venue.location.city.replace(/\s+/g, '');
                            var venue = "#" + venue.name.replace(/\s+/g, '');

                            hashtags.entity.push({
                                "type": "City",
                                "tag": city
                            });

                            hashtags.entity.push({
                                "type": "venue",
                                "tag": venue
                            });
                        }

                        if (venue.events && venue.events.data.length > 0) {
                            venue.events.data.forEach(function(event, index, array) {

                                if ((new Date(event.end_time).getTime() / 1000) > (new Date().getTime() / 1000)) {
                                    venuesWithEvents++;

                                    var eventDescriptionResultObj = {};
                                    var eventResultObj = {};
                                    eventResultObj.venueName = venue.name;
                                    eventResultObj.venueLocation = (venue.location ? venue.location : null);
                                    eventDescriptionResultObj.eventName = event.name;
                                    eventDescriptionResultObj.eventDescription = (event.description ? event.description : null);
                                    eventResultObj.eventStarttime = (event.start_time ? event.start_time : null);
                                    eventResultObj.eventDistance = (venue.location ? (haversineDistance([venue.location.latitude, venue.location.longitude], [req.query.lat, req.query.lng], false) * 1000).toFixed() : null);
                                    eventResultObj.eventTimeFromNow = calculateStarttimeDifference(currentTimestamp, event.start_time);
                                    eventResultObj.eventStats = {
                                        attendingCount: event.attending_count,
                                        declinedCount: event.declined_count,
                                        maybeCount: event.maybe_count,
                                        noreplyCount: event.noreply_count
                                    };
                                    events.push(eventResultObj);
                                    eventsDescription.push(eventDescriptionResultObj);
                                    eventsCount++;
                                }
                            });
                        }
                    });
                });

                if (venuesWithEvents != 0) {
                    var text = JSON.stringify(eventsDescription);
                    text = text.replace(/\"eventName\":/g, '').replace(/\"eventDescription\":/g, '');
                    console.log(text);

                    //sends the recived event description to alchemy entity extraction.
                    alchemyapi.entities("text", text, {}, function(response) {

                        console.log(response);
                        var index;
                        for (index = 0; index < response.entities.length; ++index) {
                            //print result
                            var recivedType = response.entities[index].type;
                            //filters out words based on the categorys "Person, Organization, Holiday and MusicGroup. (see alchemyapi.com for available categories)"
                            if (recivedType == "Person" || recivedType == "Organization" || recivedType == "Holiday" || recivedType == "MusicGroup") {
                                var tag = response.entities[index];
                                hashtags.entity.push({
                                    "type": tag.type,
                                    "tag": "#" + tag.text.replace(/\s+|\\n/g, '')
                                });
                            }
                        }
                        res.send(hashtags);
                    });
                } else {
                    //return only the city and venue name.
                    console.log("No events found");
                    res.send(hashtags);
                }
            });
    }
});

module.exports = router;
