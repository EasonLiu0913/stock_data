'use strict';
// Compare shared sentence content; editorial insight metadata remains independent.
function matches(packet,candidate){
 if(!Array.isArray(packet?.sentences)||!Array.isArray(candidate?.sentences))return false;
 const project=xs=>xs.map(x=>[x?.id,x?.narration,x?.subtitle,x?.spoken_subtitle_mappings||[]]);
 return JSON.stringify(project(packet.sentences))===JSON.stringify(project(candidate.sentences));
}
module.exports={matches};
