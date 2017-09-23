const skygearCloud = require('skygear/cloud')
const { handleOAuth } = require('./handlers')

/**
 * Check availability after a git push
 */
skygearCloud.handler('ping', req => 'Hello, world\n', {
  method: ['GET'],
  userRequired: false
})

/**
 * Test any new feature here
 */
skygearCloud.handler('dev', req => {

}, {
  method: ['GET'],
  userRequired: false
})

skygearCloud.handler('oauth', handleOAuth, {
  method: ['GET'],
  userRequired: false
})
