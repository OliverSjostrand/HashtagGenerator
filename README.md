#Hashtag Generator

Author: Oliver Sjostrand            
Email: Oliver.Sjostrand@hotmail.se

This is an API that returns JSON-formatted hastags based on location.
The program uses Facebooks Graph API to get nearby events and the description for those events. 
It then uses Alchemy entity extraction to catogorize and filter out things like names and locations from the description.

![hashtag generator without api connect](https://cloud.githubusercontent.com/assets/22015067/18258312/708146fc-73d3-11e6-9496-df2b6ef45242.jpg)

#Input
URL query is in the format /events?lat="LATITUDE"&lng="LONGITUDE"&distance="DISTANCE"
Example:
http://localhost:3000/events?lat=51.5074247&lng=-0.1283064&distance=1000


#Output
Here's an example output when using the coordinates from the Science Museum in London during a conferance:
```
{"entity":[{"type":"City","tag":"#London"},{"type":"venue","tag":"#ScienceMuseum"},
{"type":"Person","tag":"#BuzzAldrin"},{"type":"Person","tag":"#BrianCox"},
{"type":"Company","tag":"#NASA"},{"type":"Person","tag":"#NeilArmstrong"},
{"type":"Organization","tag":"#SchoolofPhysicsandAstronomy"},
{"type":"Organization","tag":"#Universityofmanchester"}]}`
```



#Instructions 
1. Go to index.js and replace "XXXXXXX" with your Facebook token
2. Go to api_key.txt and replace the content with your Alchemy API key.
3. Run npm install

