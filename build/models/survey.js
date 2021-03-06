'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const skygear = require('skygear');
const CronJob = require('cron').CronJob;
const User = require('./user.js');
const Reply = require('./reply.js');
const db = require('../db.js');
const slack = require('../slack.js');
const QUESTION = require('../config.js').QUESTION;
const DEV_MODE = require('../config.js').DEV_MODE;
const TIMEZONE = require('../config.js').TIMEZONE;
const frequency = require('../frequency.js');

class Survey {
  constructor(record, targetsCount) {
    this.record = record || new Survey.Record({
      sent_at: new Date(),
      targets_count: targetsCount,
      is_completed: false
    });
  }

  static get Record() {
    let table = DEV_MODE ? 'dev_survey' : 'survey';
    return skygear.Record.extend(table);
  }

  get attachment() {
    return {
      fallback: 'You are unable to fill in survey',
      callback_id: 'submit-survey',
      actions: [{
        name: this.record._id,
        text: 'Choose a score...',
        type: 'select',
        options: [{
          text: '10 (Highest)',
          value: '10'
        }, {
          text: '9',
          value: '9'
        }, {
          text: '8',
          value: '8'
        }, {
          text: '7',
          value: '7'
        }, {
          text: '6',
          value: '6'
        }, {
          text: '5',
          value: '5'
        }, {
          text: '4',
          value: '4'
        }, {
          text: '2',
          value: '2'
        }, {
          text: '1 (Lowest)',
          value: '1'
        }]
      }]
    };
  }

  get replies() {
    if (this.record.is_completed) {
      let query = new skygear.Query(Reply.Record);
      query.equalTo('survey', this.record._id);
      return db.query(query); // .map(record => new Reply(record))
    } else {
      throw new Error('The survey has not yet closed.');
    }
  }

  save() {
    var _this = this;

    return _asyncToGenerator(function* () {
      _this.record = yield db.save(_this.record);
    })();
  }

  static getByID(id) {
    let query = new skygear.Query(Survey.Record);
    query.equalTo('_id', id);
    return db.query(query).then(records => {
      return records[0] ? new Survey(records[0]) : null;
    });
  }

  static get lastCompleted() {
    let query = new skygear.Query(Survey.Record);
    query.equalTo('is_completed', true);
    query.addDescending('_updated_at');
    return db.query(query).then(records => {
      return records[0] ? new Survey(records[0]) : null;
    });
  }

  static get waitingReply() {
    let query = new skygear.Query(Survey.Record);
    query.equalTo('is_completed', false);
    return db.query(query).then(records => {
      return records[0] ? new Survey(records[0]) : null;
    });
  }

  static send(exclusion) {
    return _asyncToGenerator(function* () {
      let targets = yield User.filteredUsers(exclusion);
      let survey = new Survey(null, targets.length);
      yield survey.save();
      let opts = {
        as_user: true,
        attachments: [survey.attachment]
      };
      targets.forEach(function (target) {
        return slack.chat.postMessage(target.id, QUESTION, opts);
      });
      let delay = DEV_MODE ? 1000 * 30 : 1000 * 60 * 20;
      setTimeout(survey.completed.bind(survey), delay);
    })();
  }

  completed() {
    this.record.is_completed = true;
    this.save();
  }

  static schedule(f, exclusion) {
    let cron = frequency[f];
    if (cron) {
      if (global.scheduled instanceof CronJob) {
        global.scheduled.stop();
      }
      global.scheduled = new CronJob(cron, Survey.send.bind(null, exclusion), null, true, TIMEZONE);
    } else {
      throw new Error('cron not defined');
    }
  }
}

module.exports = Survey;