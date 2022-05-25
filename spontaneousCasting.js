/**
 * Provides simple menu for replacing a prepared spell slot with a casting of a class' spontaneous replacement spell (e.g. Cure spells for good Clerics).
 * 
 * Caster must have a spellbook with prepared spells and the spontaneous replacement must be set as an at-will spell.
 **/

// CONFIGURATION
// Leave the actorNames array empty to guess the players
// Example actorNames: `actorNames: ["Bob", "John"],
// Fill in allowed prepared caster classes that spontaneous replace in lower case below
const c = {
  actorNames: [],
  spontClasses: ["druid", "cleric", "warpriest"]
};
// END CONFIGURATION

// Find the actor
const tokens = canvas.tokens.controlled;
let actors = tokens.map(o => o.actor);
if (!actors.length && c.actorNames.length) actors = game.actors.entities.filter(o => c.actorNames.includes(o.name));
if (!actors.length) actors = game.actors.entities.filter(o => o.hasPlayerOwner && o.testUserPermission(game.user, "OWNER") && o.name === game.user.character.name);
actors = actors.filter(o => o.testUserPermission(game.user, "OWNER"));

// Must have 1 actor
if (!actors.length) ui.notifications.warn("No applicable actor found");
if (actors.length > 1) ui.notifications.warn("Please choose one actor");
else {
  // Check for spellbooks
  let activeBooks = actor.data.data.attributes.spells.usedSpellbooks;
  if (!activeBooks.length) ui.notifications.warn(`${actor.data.name} does not have any spellbooks active`);
  else {
    // Get spellbook info
    let spellbooks = [];
    activeBooks.forEach((o) => {
      let book = actor.data.data.attributes.spells.spellbooks[o];
      if (c.spontClasses.includes(book.class)) spellbooks.push([o, book]);
    });

    // Build spellbook options
    let bookOptions = spellbooks.map((o, index) => `<option value="${o.name}">${o[1].name} (${o[1].class}-${o[0]})</option>`);
    if (!bookOptions.length) ui.notifications.warn("No valid spellbooks available");
    else {

      // Build prepared slot and spontaneous replacement options
      console.log(spellbooks[0]);
      let slotOptions = populatePrepared(null, spellbooks[0][0]);
      if (!slotOptions[1].length) {
        ui.notifications.warn(`${actor.data.name} does not have any spells prepared`);
      }
      else {
        let slotSpellID = slotOptions[1].length > 0? slotOptions[1][0].id : null;
        let castOptions = populateSpontaneous(null, slotSpellID);
        let form = `
          <form class="flexcol">
            <div class="form-group">
              <label>Caster:</label>
              <p>${actor.name}</p>
            </div>
            <div class="form-group">
              <label>Spellbook:</label>
              <select id="classSelect" style="text-transform: capitalize">${bookOptions}</select>
            </div>
            <div class="form-group">
              <label>Spell Slot to Use:</label>
              <select id="slotSelect">${slotOptions[0]}</select>
            </div>
            <div class="form-group">
              <label>Spell to Cast:</label>
              <select id="castSelect">${castOptions}</select>
            </div>
          </form>
      `;

        // Display UI
        const dialog = new Dialog({
          title: "Spontaneous Casting",
          content: form,
          buttons: {
            use: {
              icon: '<i class="fas fa-dice-d20"></i>',
              label: "Use Spell Slot",
              callback: useSpell
            }
          },
          render: (htm) => {
            htm.find('#classSelect').change(populatePrepared.bind(this, htm, null));
            htm.find('#slotSelect').change(populateSpontaneous.bind(this, htm, null));
          },
        }).render(true);
      }
    }
  }

}

/**
 * Removes one use of the prepared spell and casts the spontaneous spell
 * Outputs a chat card of the used and replacement spells
 **/
function useSpell(htm, event) {
  // Get the info about the spells
  let usedSlotID = htm.find('#slotSelect')[0].value;
  let spontSpellID = htm.find('#castSelect')[0].value;
  let usedSpell = actor.items.find(o => o.id === usedSlotID);
  let spontSpell = actor.items.find(o => o.id === spontSpellID);
    
  // Update used spell preparations
  let newUses = usedSpell.data.data.preparation.preparedAmount - 1;
  actor.items.get(usedSlotID).update({
    "data.preparation.preparedAmount": newUses
  });

  // Build chat card and display
  let msg = `<div class="pf1 chat-card">
                    <header class="card-header flexrow">
                        <h3 class="actor-name">Spontaneous Replacement</h3>
                    </header>
                    <div class="result-text">
                        <p>${actor.name} loses level ${usedSpell.data.data.level} ${usedSpell.data.name} preparation to cast ${spontSpell.name}.</p>
                    </div>
                </div>`;

  ChatMessage.create({
    content: msg
  });
    
    //console.log(spontSpell.name, spontSpellID, actor.id);
    
  // Use the spontaneous spell
//   game.pf1.rollItemMacro(spontSpell.name, {
//     itemId: spontSpellID,
//     itemType: "spell",
//     actorId: actor.id,
//   });

    spontSpell.use();
}

/**
 * Populates the prepared options select element with options
 * 
 **/
function populatePrepared(htm, spellbook, event = null) {
  // Either get the spellbook info from the form or from the passed name
  let selectedBook = !spellbook ? htm.find('#classSelect')[0].value : spellbook;

  // Get the currently prepared spells in the book, ordered highest level to lowest
  let availableSpells = actor.data.items.filter(o => o.type === "spell" && o.data.data.level > 0 && !o.data.data.atWill && o.data.data.preparation.preparedAmount > 0 && o.data.data.spellbook === selectedBook.toLowerCase()).sort(function(a, b) {
    return b.data.data.level - a.data.data.level;
  });

  // Build the options, if any
  let slotOptions = "";
  if (availableSpells.length) {
    slotOptions = availableSpells.map(o => `<option value="${o.id}">${o.name} (lv ${o.data.data.level}, ${o.data.data.preparation.preparedAmount} avail)</option>`);
  } else slotOptions = "<option>No Prepared Slots Available</option>";

  // If called from the form, update the form
  if (htm) {
    htm.find('#slotSelect')[0].innerHTML = slotOptions;
    if (availableSpells.length) populateSpontaneous(htm, availableSpells[0]._id);
    else populateSpontaneous(htm, null);
  }

  // For initial form building
  return [slotOptions, availableSpells];
}


/**
 * Populates the spontaneous replacement options select element
 **/
function populateSpontaneous(htm, spellSlotID, event = null) {
  // Get info about the prepared spell
  let selectedSpellID = !spellSlotID ? htm.find('#slotSelect')[0].value : spellSlotID;
  let selectedSpell = actor.data.items.find(o => o.id === selectedSpellID);
  let slotLevel = selectedSpell?.data.data.level;

  // Find at-will spells of the same level or lower to spontaneous cast
  let spontSpells = actor.data.items.filter(o => o.type === "spell" && o.data.data.level <= slotLevel && o.data.data.atWill && o.data.data.spellbook === selectedSpell.data.data.spellbook.toLowerCase()).sort(function(a, b) {
    return b.data.data.level - a.data.data.level
  });

  // Build the options if any
  let spontOptions = "";
  if (spontSpells.length) {
    spontOptions = spontSpells.map(o => `<option value="${o.id}">${o.name} (lv ${o.data.data.level})</option>`);
  } else spontOptions = "<option>No At Will Spells Available</option>";

  // If called from the form, update the form
  if (htm) {
    htm.find('#castSelect')[0].innerHTML = spontOptions;

    // If no options available, disable the use button
    if (!spontSpells.length) htm.find('button')[0].disabled = true;
    else htm.find('button')[0].disabled = false;
  }

  // For initial form building
  return spontOptions;
}
