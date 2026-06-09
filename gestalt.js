// Creates a gestalt class from 2 chosen pf1 classes, puts the class in your world items tab
// if both classes are spellcasting classes, it just gives the automatic progression of the first class, so you will need to set that up
// Add the id of any compendiums containing classes you want into the array below. If you need help identifying an id, you can run the following code in a macro or console to get a long chat message containing the name and id of all item compendiums
// ChatMessage.create({content: game.packs.filter(o => o.metadata.type === 'Item').map(o => {return '<p><strong>name:</strong> ' + o.metadata.name + ', <strong>id:</strong> ' + o.metadata.id + '</p>'}).sort().join('')})
const classPacks = ['pf1.classes'];

// Commend out the previous line and uncomment the next line to search EVERY item compendium.. WARNING: This is likely to find you a lot of classes you're not interested in, and some that may not have supported data
//const classPacks = game.packs.contents.filter(o => o.metadata.type === 'Item').map(o => o.metadata.id);

const classPack = [];

for (const pack of classPacks) {
  const docs = await game.packs.get(pack)?.getDocuments({type: 'class'}) ?? [];
  classPack.push(...docs);
}

const classes = classPack.map(o => {return {id: o.uuid, name: o.name}}).sort((a,b) => {return (b.name < a.name ? 1 : b.name > a.name ? -1 : 0)});

const classSelector1 = `<select id="class1">${classes.map(o => `<option value='${o.id}'>${o.name}</option>`)}</select>`
const classSelector2 = `<select id="class2">${classes.map(o => `<option value='${o.id}'>${o.name}</option>`)}</select>`

let d = new Dialog({
    title: "Gestalt Generator",
    content: `<div><label for="class1">Class 1: </label>${classSelector1}<br><label for="class2">Class 2: </label>${classSelector2}</div>`,
    buttons: {
        ok: {
            label: "Ok",
            callback: async html => {
                let choice1 = html.find('#class1')[0].value;
                let choice2 = html.find('#class2')[0].value;
                const class1 = (await fromUuid(choice1)).toObject();
                const class2 = (await fromUuid(choice2)).toObject();

                //SETS ICON
                class1.img = "systems/pf1/icons/feats/improved-feint.jpg";

                class1.name = class1.name + '/' + class2.name,
                class1.system.hd = Math.max(class1.system.hd, class2.system.hd);
                class1.system.bab = (class1.system.bab === 'high' || class2.system.bab === 'high') ? 'high' : class2.system.bab === 'med'? 'med' : class1.system.bab;
                class1.system.skillsPerLevel = Math.max(class1.system.skillsPerLevel, class2.system.skillsPerLevel);
                class1.system.weaponProf = class1.system.weaponProf.concat(class2.system.weaponProf.filter(o => !class1.system.weaponProf.includes(o)));
                class1.system.armorProf = class1.system.armorProf.concat(class2.system.armorProf.filter(o => !class1.system.armorProf.includes(o)));
                class1.system.savingThrows.fort = {
                    value: (class1.system.savingThrows.fort.value === 'high' || class2.system.savingThrows.fort.value === 'high') ? 'high': class1.system.savingThrows.fort.value === 'low' ? 'low' : class2.system.savingThrows.fort.value};
                class1.system.savingThrows.ref = {
                    value: (class1.system.savingThrows.ref.value === 'high' || class2.system.savingThrows.ref.value === 'high') ? 'high': class1.system.savingThrows.ref.value === 'low' ? 'low' : class2.system.savingThrows.ref.value};
                class1.system.savingThrows.will = {
                    value: (class1.system.savingThrows.will.value === 'high' || class2.system.savingThrows.will.value === 'high') ? 'high': class1.system.savingThrows.will.value === 'low' ? 'low' : class2.system.savingThrows.will.value};
                Object.keys(class2.system.classSkills).forEach(s => class1.system.classSkills[s] = class1.system.classSkills[s] || class2.system.classSkills[s]);
                class1.system.tag = class1.system.tag + class2.system.tag.charAt(0).toUpperCase() + class2.system.tag.slice(1);
                class1.system.description.value = `<h1>${class1.name}</h1>${class1.system.description.value}<h1>${class2.name}</h1>${class2.system.description.value}`;
                class1.system.links.classAssociations = class1.system.links.classAssociations.concat(class2.system.links.classAssociations);
                class1.system.casting = !!class1.system.casting?.ability ? class1.system.casting : class2.system.casting;
                const class1WealthFormula = class1.system.wealth.length > 0 ? class1.system.wealth.replace("d12", " * 6.5").replace("d10", " * 5.5").replace("d8", " * 4.5").replace("d6", " * 3.5").replace("d4", " * 2.5") : "0"; 
                const class2WealthFormula = class2.system.wealth.length > 0 ? class2.system.wealth.replace("d12", " * 6.5").replace("d10", " * 5.5").replace("d8", " * 4.5").replace("d6", " * 3.5").replace("d4", " * 2.5") : "0";;
                const class1Wealth = await new Roll(class1WealthFormula).evaluate();
                const class2Wealth = await new Roll(class2WealthFormula).evaluate();
                class1.system.wealth = class1Wealth.total > class2Wealth.total ? class1.system.wealth : class2.system.wealth;
                Item.create(class1);
            }
        }
    }
}).render(true);
