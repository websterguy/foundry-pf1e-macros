// Creates a gestalt class from 2 chosen pf1 classes, puts the class in your world items tab
// if both classes are spellcasting classes, it just gives the automatic progression of the first class, so you will need to set that up
const classPack = game.packs.get('pf1.classes');

const classes = classPack.index.map(o => {return {id: o._id, name: o.name}}).sort((a,b) => {return (b.name < a.name ? 1 : b.name > a.name ? -1 : 0)});

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
                const class1 = (await classPack.getDocument(choice1)).toObject();
                const class2 = (await classPack.getDocument(choice2)).toObject();

                //SETS ICON
                class1.img = "systems/pf1/icons/feats/improved-feint.jpg";

                class1.name = class1.name + '/' + class2.name,
                class1.system.hd = Math.max(class1.system.hd, class2.system.hd);
                class1.system.bab = (class1.system.bab === 'high' || class2.system.bab === 'high') ? 'high' : class2.system.bab === 'med'? 'med' : class1.system.bab;
                class1.system.skillsPerLevel = Math.max(class1.system.skillsPerLevel, class2.system.skillsPerLevel);
                class1.system.weaponProf.value = class1.system.weaponProf.value.concat(class2.system.weaponProf.value.filter(o => !class1.system.weaponProf.value.includes(o)));
                class1.system.armorProf.value = class1.system.armorProf.value.concat(class2.system.armorProf.value.filter(o => !class1.system.armorProf.value.includes(o)));
                class1.system.weaponProf.custom.push(...class2.system.weaponProf.custom.filter(o => !class1.system.weaponProf.custom.includes(o)));
                class1.system.weaponProf.custom = class1.system.weaponProf.custom.toSorted();
                class1.system.armorProf.custom.push(...class2.system.armorProf.custom.filter(o => !class1.system.armorProf.custom.includes(o)));
                class1.system.armorProf.custom = class1.system.armorProf.custom.toSorted();
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
