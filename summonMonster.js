/**
 * Allows any user with permission to create new actors to import one from a compendium
 * If that user also has permission to create tokens, will create the specified amount in a stack on top of their current token
 * Gives ownership of the summoned tokens to the summoner
 * 
 * If Turn Alert module is enabled and there is a current combat, will place an alert for when the summons expire
 * 
 * GM users must select a token to act as the summoner
 * Player users must have their character configured under player configuration (linked to their user in the bottom left list of connected/disconnected users)
 * The above can be disabled in config to allow players users to use any owned token as the summoner, but they must select a token
 *
 * Uses standard Pathfinder 1e summon monster/nature's ally rules
 * (1 round/CL, close range, extend metamagic doubles duration, reach metamagic is medium range)
 * 
 **/
const config = {
    packSource: ["pf1"], // list of package sources for summons actor folders
    ignoreCompendiums: [""],
    destinationFolder: "Summons", // Folder to file summons in when imported. Will be auto-created by GM users, but not players
    renameAugmented: true, // Appends "(Augmented)" to the token if augmented"
    useUserLinkedActorOnly: true // Change to false to allow users to use any selected token they own as the summoner
};

// Check for Turn Alert module
const turnAlertActive = game.modules.get("turnAlert")?.active;

// Build options for folders to summon from
let packOptions = `<option value=""></option>` + game.packs.filter(p => p.entity === "Actor" && config.packSource.includes(p.metadata.package) && !config.ignoreCompendiums.includes(p.metadata.label)).map(p => `<option value="${p.collection}">${p.title}</option>`);

let summonerActor;
let summonerToken;
let classArray = [];
let gNumSpawned = 0;
let gNeedSpawn = 100;
let createdMonster;
let range = 0;

// Get actor and token info
if (game.user.isGM || !config.useUserLinkedActorOnly) {
    // GMs must have a token selected
    let selectedTokens = canvas.tokens.controlled;
    if (!selectedTokens.length) ui.notifications.warn("No token chosen as summoner.");
    else {
        summonerToken = selectedTokens[0];
        summonerActor = summonerToken.actor;
    }
}
else {
    // Non GMs must have a character and a token for that character on the map
    summonerActor = game.user.character;
    if (!summonerActor) ui.notifications.warn("No token chosen as summoner.");
    else {
        summonerToken = canvas.tokens.ownedTokens.filter(o => o.data.actorId === summonerActor.data._id)[0];
        if (!summonerToken) ui.notifications.warn(`No token of summoner ${summonerActor.name} available.`);
    }
}

if (summonerActor && summonerToken) {
    // Build list of character's classes sorted by level (high to low)
    classArray = Object.values(summonerActor.data.data.classes).sort(function(a, b) {return b.level - a.level});
    let classOptions = classArray.map((p, index) => `<option value="${index}">${p.name} (Level ${p.level})</option>`);
    
    let ownerCheck = "";
    if (game.user.isGM && summonerActor.hasPlayerOwner) ownerCheck = `<div class="form-group"><label>Give Ownership to ${summonerActor.name}'s Owners:</label><input type="checkbox" id="ownerCheck"></div>`;
    
    // Build UI
    const form = `
        <form class="flexcol">
            <div class="form-group">
                <label>Summoner:</label>
                <p>${summonerActor.name}</p>
            </div>
            <div class="form-group">
                <label>CL Class:</label>
                <select id="classSelect">${classOptions}</select>
            </div>
            <div class="form-group">
                <label>CL Override:</label>
                <input type="number" id="clOverride" placeholder="CL (e.g. for scrolls)">
            </div>
            <div class="form-group">
                <label>Summon From:</label>
                <select id="sourceSelect">
                    ${packOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Summon:</label>
                <select id="monsterSelect">
                </select>
            </div>
            <div class="form-group">
                <label>Number to Summon:</label>
                <input type="text" id="summonCount" placeholder="e.g. 1, 1d4+1">
            </div>
            <div class="form-group">
                <label>Augment Summoning:</label>
                <input type="checkbox" id="augmentCheck">
            </div>
            <div class="form-group">
                <label>Extend (Metamagic):</label>
                <input type="checkbox" id="extendCheck">
            </div>
            <div class="form-group">
                <label>Reach (Metamagic):</label>
                <input type="checkbox" id="reachCheck">
            </div>
            ${ownerCheck}
        </form>
    `;
    
    // Display UI
    const dialog = new Dialog({
      title: "Summon Monster",
      content: form,
      buttons: {
        use: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Summon",
          callback: importMonster
        }
      },
      render: (htm) => {
        htm.find('#sourceSelect').change(populateMonster.bind(this, htm));
      },
    }).render(true);
}

/**
 * On change of source dropdown, populate summon options from the chosen folder
 **/
async function populateMonster(htm, event) {
    // Get the chosen folder
    let selectedPack = event.target.value;
    let monsterSelect = htm.find("#monsterSelect")[0];
    
    // Populate the options or leave blank if no target chosen
    let monsterOptions = "";
    if (selectedPack) {
        let monsterList = await game.packs.get(selectedPack).getIndex();
        monsterOptions = monsterList.map(p => `<option value="${p._id}">${p.name}</option>`);
    }
    
    // Replace options
    monsterSelect.innerHTML = monsterOptions;
}

/**
 * Spawns the token of createdMonster at the position of the mouse when clicked
 */
async function spawnToken() {
    let tokenForId = await canvas.tokens.createMany(createdMonster.data.token, {temporary: true});
    
    let location = getCenterGrid(getMousePosition());
 
    tokenForId.x = location.x;
    tokenForId.y = location.y;
 
    // Increase this offset for larger summons
    tokenForId.x -= (scene.data.grid/2+(tokenForId.width-1)*scene.data.grid);
    tokenForId.y -= (scene.data.grid/2+(tokenForId.height-1)*scene.data.grid);
 
    await canvas.tokens.createMany(tokenForId);
 }

/**
 * Imports the selected monster into the game world, sorts it into the desired folder (if any),
 * spawns the desired number of tokens on top of the summoner's token, creates a chat message giving
 * details about the summon that occured, and creates a Turn Alert alert for when the summon ends (if
 * there is currently combat and Turn Alert is enabled)
 **/
async function importMonster(html) {
    // Get the details of the selected summon
    let selectedPack = html.find("#sourceSelect")[0].value;
    let selectedMonster = html.find("#monsterSelect")[0].value;
    
    // Gets info about the destination folder, creates it if it does not exist
    let folderID = "";
    
    if (config.destinationFolder) {
        let summonFolder = game.folders.getName(config.destinationFolder);
        
        if (summonFolder === null) {
            let folder = await Folder.create({name: config.destinationFolder, type: "Actor", parent: null});
            folderID = folder._id;
        }
        else {
            folderID = summonFolder._id;
        }
    }
    
    // Import the monster from the compendium
    let monsterEntity = game.packs.get(selectedPack).getEntity(selectedMonster);
    await Promise.resolve(monsterEntity).then(async function(value){
        createdMonster = await Actor.create(value);
    })
    
    // Update the actor permissions
    let currentPermission = createdMonster.data.permission;
    let updatedPermission = currentPermission[game.userId] = 3;
    if (game.user.isGM && summonerActor.hasPlayerOwner) {
        let giveOwnerCheck = html.find('#ownerCheck')[0].checked;
        if (giveOwnerCheck) updatedPermission = summonerActor.data.permission;
    }
    await createdMonster.update({"folder": folderID, "permission": updatedPermission});
    
    // Get info about summon count
    let countFormula = html.find("#summonCount").val();
    let roll;
    let rollResult = 0;
    let rollHtml = "";
    
    // Verify summon count formula is valid and will result in at least 1 summon
    if (!Roll.validate(countFormula) || (new Roll(countFormula).evaluate({minimize: true}).total <= 0)) {
        ui.notifications.error(`${countFormula} not a valid roll formula. Defaulting to 1.`);
        countFormula = "1";
    }
    
    // Calculate the roll
    roll = new Roll(countFormula).roll();
    rollResult = roll.total;
    gNeedSpawn = rollResult;
    
    // Find chosen caster level info
    let chosenIndex = parseInt(html.find("#classSelect").val());
    let classCL = classArray[chosenIndex].level;
    let casterLevel = classCL;
    let clOverride = parseInt(html.find("#clOverride").val());
    
    // Validate caster level override is a number > 0
    if (!isNaN(clOverride)) {
        if (clOverride <= 0) ui.notifications.error(`${clOverride} not a valid caster level. Defaulting to class level.`);
        else casterLevel = clOverride;
    }
    
    //Set up buff for augment
    let buffData = null;
    if (html.find("#augmentCheck")[0].checked) {
        buffData = { type: "buff", name: "Augment Summoning", data: { buffType: "temp" } };
    }
    
    // Set up range as close or medium based on caster level and range metamagic
    if (html.find("#reachCheck")[0].checked) range = (100 + (casterLevel * 10));
    else range = (25 + (Math.floor(casterLevel / 2) * 5));
    
    // Double caster level for extend metamagic
    if (html.find("#extendCheck")[0].checked) casterLevel *= 2;
    
    // Create the buff on the actor for augment, set the bonuses, hide it on the token, and change actor's name
    if (buffData) {
        await createdMonster.createOwnedItem(buffData);
        let buff = createdMonster.items.find(o => o.name === "Augment Summoning" && o.type === "buff");
        let changes = [];
        changes.push({formula: "4", priority: 1, target: "ability", subTarget: "str", modifier: "enh"});
        changes.push({formula: "4", priority: 1, target: "ability", subTarget: "con", modifier: "enh"});
        await buff.update({"data.changes": changes, "data.hideFromToken": true});
        await buff.update({"data.active": true});
        let actorName = createdMonster.name + " (Augmented)";
        await createdMonster.update({"name": actorName});
        await createdMonster.update({"token.name": actorName});
    }
    
    
    // Wait for summoner to spawn the rolled number of tokens on the canvas
    ui.notifications.info(`Click spawn location for ${createdMonster.name} within ${range} ft of summoner (${gNumSpawned} of ${gNeedSpawn})`);
    captureClick();
    
    await sleepWhilePlacing();
    
    stopCapture();
    
    ui.notifications.info("Done spawning summons!");
    
    // If there is a combat active and Turn Alert is enabled, create an alert at this initiative in CL rounds
    let thisCombatant = game.combat?.combatant;
    if (thisCombatant && turnAlertActive) {
        if (casterLevel > 0) {
            const alertData = {
                round: casterLevel,
                roundAbsolute: false,
                turnId: thisCombatant._id,
                message: `${createdMonster.name} disappears.`
            }
            
            TurnAlert.create(alertData);
        }
    }
    
    // Check if dice so nice is active and use it to show the roll if applicable
    if (game.modules.get("dice-so-nice")?.active) game.dice3d.showForRoll(roll);
    
    // Create chat message about summon
    let msg = `<div class="pf1 chat-card">
                    <header class="card-header flexrow">
                        <h3 class="actor-name">Summoning!</h3>
                    </header>
                    <div class="result-text">
                        <p><a class="inline-roll inline-result" title="${roll.formula}" data-roll="${encodeURI(JSON.stringify(roll))}"><i class="fas fa-dice-d20"></i> ${roll.total}</a> ${createdMonster.name} summoned for ${casterLevel} rounds within ${range} feet range.</p>
                    </div>
                </div>`
                
    ChatMessage.create({
        content: msg
    });
}

/**
 * The following functions were provided by the Foundry community.
 * 
 * Captures mouse clicks, determines the square to spawn monster in through mouse position at time of click, and spawns the token at that location.
 */
function getMousePosition() {
  const mouse = canvas.app.renderer.plugins.interaction.mouse;
  return mouse.getLocalPosition(canvas.app.stage);
}

function getCenterGrid(point = {})
{
  const arr = canvas.grid.getCenter(point.x, point.y);
  return { x: arr[0], y : arr[1] };
}

async function handleClick(event) {
    if(gNumSpawned < gNeedSpawn && !!createdMonster){
        await spawnToken();
        gNumSpawned++;
        ui.notifications.info(`Click spawn location for ${createdMonster.name} within ${range} ft of summoner (${gNumSpawned} of ${gNeedSpawn})`);
    }
}
 
function captureClick() {
  $(document.body).on("click", handleClick);
}
 
function stopCapture() {
   $(document.body).off("click", handleClick); 
}
 
const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
 
async function sleepWhilePlacing() {
    while(gNumSpawned<gNeedSpawn){
        await wait(100);
    }
}
