const querystring = require('querystring')
const VERIFICATION_TOKEN = require('../config.js').VERIFICATION_TOKEN
const DEVELOPERS = require('../config.js').DEVELOPERS
const User = require('../models/user.js')

const askNow = require('./commands/ask-now.js')
const requestFrequency = require('./commands/schedule.js')
const stopScheduling = require('./commands/stop-scheduling.js')
const requestReportType = require('./commands/generate-report.js')

const scheduleSurvey = require('./actions/schedule-survey.js')
const submitSurvey = require('./actions/submit-survey.js')
const generateReport = require('./actions/generate-report.js')

const submitReason = require('./events/submit-reason.js')

function isFromSlack (request) {
  return request.token === VERIFICATION_TOKEN
}

async function isAdmin (userID) {
  let user = await User.getByID(userID)
  return user.is_admin || DEVELOPERS.includes(user.name)
}

exports.handleCommand = async (req) => {
  let request = querystring.parse(req.body)
  console.log(request)
  if (isFromSlack(request)) {
    if (await isAdmin(request.user_id)) {
      switch (request.command) {
        case '/nps-ask-now':
          return askNow(request.text)
        case '/nps-schedule':
          return requestFrequency(request.text)
        case '/nps-stop-scheduling':
          return stopScheduling()
        case '/nps-generate-report':
          return requestReportType()
        default:
          return 'Invalid command'
      }
    } else {
      return 'Permission denied. Only team admins or developers of this app could issue this command.'
    }
  } else {
    return 'Unknown source'
  }
}

exports.handleAction = (req) => {
  let request = querystring.parse(req.body)
  request = JSON.parse(request.payload)
  console.log(request)
  if (isFromSlack(request)) {
    switch (request.callback_id) {
      case 'submit-survey':
        return submitSurvey(request.actions[0].name, request.user.id, parseInt(request.actions[0].selected_options[0].value))
      case 'schedule-survey':
        return scheduleSurvey(request.actions[0].value)
      case 'generate-report':
        return generateReport(request.actions[0].value, request.response_url, request.user.id)
      default:
        return 'Invalid action'
    }
  } else {
    return 'Unknown source'
  }
}

exports.handleEvent = (req) => {
  let body = JSON.parse(req.body)
  // one-time verification to enable event subscription
  if (body.challenge) {
    return body.challenge
  }

  let event = body.event
  console.log(event)
  switch (event.type) {
    case 'message':
      // avoid the loop created by bot
      return event.bot_id ? '' : submitReason(event.user, event.text)
    default:
      return 'Invalid event type'
  }
}
