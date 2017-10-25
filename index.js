var express = require('express')
var bodyParser = require('body-parser')
var has = require('lodash').has
var filter = require('lodash').filter
var toNumber = require('lodash').toNumber
var get = require('lodash').get
var mapValues = require('lodash').mapValues

var app = express()

app.use(bodyParser.json())

var calcParamsSchema = {
  required: [
    'monthlyCosts',
    'yearsInRetirement',
    'yearsUntilRetirment',
    'inflation',
    'preRateOfReturn',
    'postRateOfReturn',
    'taxRate',
    'currentTaxDeferredCapital',
    'monthlyIncome'
  ]
}

app.get('/', function (req, res) {
  res.status(200).send({
    swagger: '2.0',
    info: {
      description:
        'This is a sample retirement calculator using tax-deferred savings only.',
      version: '1.0.0',
      title: 'Retirement Calc'
    },
    host: 'wt-f2d928a96e64c8796d70d3055c64414c-0.run.webtask.io',
    basePath: '/retirement-calc',
    tags: [],
    schemes: ['http'],
    paths: {
      '/': {
        get: {
          tags: [],
          summary: 'Get this swagger doc',
          description: 'Returns the sagger doc',
          produces: ['application/json'],
          responses: {
            '200': {
              description: 'successful operation',
              schema: {
                type: 'object'
              }
            }
          }
        }
      },
      '/calc': {
        post: {
          summary:
            'Calculates total amount needed to retire and annual and monthly savings required to get to that goal.',
          consumes: ['application/json'],
          produces: ['application/json'],
          parameters: [
            {
              in: 'body',
              name: 'body',
              description: 'Calc params object containing values to use',
              required: true,
              schema: {
                $ref: '#/definitions/calcObject'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Calculator result',
              schema: {
                $ref: '#/definitions/calcResult'
              }
            },
            '400': {
              description: 'Bad request',
              schema: {
                $ref: '#/definitions/calcError'
              }
            }
          }
        }
      }
    },
    definitions: {
      calcObject: {
        type: 'object',
        properties: {
          monthlyCosts: {
            description:
              'The anticipated monthly costs required in retirement in dollars.',
            type: 'number'
          },
          yearsUntilRetirment: {
            description: 'How many years until you plan to retire.',
            type: 'number'
          },
          yearsInRetirment: {
            description: 'How many years you plan to be IN retirement.',
            type: 'number'
          },
          inflation: {
            description:
              'The average annual inflation up through retirement. Provide a percentage, not a decimal.',
            type: 'number'
          },
          currentTaxDeferredCapital: {
            description:
              'The amount of tax-deferred savings you currently have.',
            type: 'number'
          },
          preRateOfReturn: {
            description:
              'Anticipated annual return on savings up until retirement. Provide a percentage, not a decimal.',
            type: 'number'
          },
          postRateOfReturn: {
            description:
              'Anticipated annual return on savings through retirement. Provide a percentage, not a decimal.',
            type: 'number'
          },
          taxRate: {
            description:
              'Anticipated tax rate in retirement. Provide a percentage, not a decimal.',
            type: 'number'
          },
          monthlyIncome: {
            description:
              'Expected monthly income during retirement in dollars e.g. social security, etc.',
            type: 'number'
          }
        }
      },
      calcResult: {
        type: 'object',
        properties: {
          atRetirementCapitalRequired: {
            description: 'The total needed the day you retire.',
            type: 'number'
          },
          annualSavingsRequired: {
            description:
              'The annual savings needed to get you to that goal provided assumptions such as rate of return and inflation hold true.',
            type: 'number'
          },
          monthlySavingsRequired: {
            description: 'Annual savings divided by 12',
            type: 'number'
          }
        }
      },
      calcError: {
        type: 'object',
        properties: {
          error: {
            description: 'Error message',
            type: 'string'
          },
          required: {
            description:
              'A list of properties that are either missing or invalid.',
            type: 'string'
          }
        }
      }
    }
  })
})

app.post('/calc', function (req, res) {
  if (req.header('content-type') !== 'application/json') {
    res.status(400).send({
      error: "Content-Type must be 'application/json'"
    })
    return
  }
  const invalidParams = validateCalcParams(req.body)
  if (invalidParams.length !== 0) {
    res.status(400).send({
      error: 'Missing params or param must be a number',
      required: invalidParams.join(', ')
    })
    return
  }

  // numbers passed as percentages should be whole numbers; convert
  const inflation = percentToDecimal(req.body.inflation)

  // first year income need is future value of (monthlyCosts - monthlyIncome) * 12
  const firstYearIncomeNeedNetTax =
    (req.body.monthlyCosts - req.body.monthlyIncome) *
    12 *
    Math.pow(1 + inflation, req.body.yearsUntilRetirment)
  const taxRate = percentToDecimal(req.body.taxRate)
  // add in taxes
  const grossFYI =
    firstYearIncomeNeedNetTax * taxRate + firstYearIncomeNeedNetTax

  // we get into a divide by zero mess if this is zero. We can handle that by setting really low...
  // not totally accurate and this can/should be "fixed" by using an iterative calculation approach
  var postRealRateOfReturn =
    percentToDecimal(req.body.postRateOfReturn) - inflation
  postRealRateOfReturn =
    postRealRateOfReturn === 0 ? 0.00001 : postRealRateOfReturn
  var preRealRateOfReturn =
    percentToDecimal(req.body.preRateOfReturn) - inflation
  preRealRateOfReturn =
    preRealRateOfReturn === 0 ? 0.00001 : preRealRateOfReturn

  // now we can get the "Year 1 value of the (years in retirement) annuity" using the PV of an annuity
  // it will be the PV at the time we retire so we'll back it up to the "real" PV after
  const year1AnnuityValue =
    grossFYI *
    (1 / postRealRateOfReturn -
      1 /
        (postRealRateOfReturn *
          Math.pow(1 + postRealRateOfReturn, req.body.yearsInRetirement)))

  // future value of our current tax deferred currentTaxDeferredCapital
  const fvCurrentCapital =
    req.body.currentTaxDeferredCapital *
    Math.pow(1 + preRealRateOfReturn, req.body.yearsUntilRetirment)

  // future value of of the additional capital required
  const fvAdditionalCapital = year1AnnuityValue - fvCurrentCapital
  // bring it back to today - the present value of that number
  const pvAdditionalCaptial =
    fvAdditionalCapital /
    Math.pow(
      1 + percentToDecimal(req.body.preRateOfReturn),
      req.body.yearsUntilRetirment
    )
  const annualSavingsRequired = (pvAdditionalCaptial /
    req.body.yearsUntilRetirment
  ).toFixed(2)
  const monthlySavingsRequired = (annualSavingsRequired / 12).toFixed(2)

  const calcResults = {
    atRetirementCapitalRequired: fvAdditionalCapital.toFixed(2),
    annualSavingsRequired,
    monthlySavingsRequired
  }
  res.status(200).send(calcResults)
})

function validateCalcParams (params) {
  return filter(calcParamsSchema.required, key => {
    if (!has(params, key) || !toNumber(get(params, key))) {
      return key
    }
  })
}

function percentToDecimal (x) {
  return x / 100
}

app.listen(3000, function () {
  console.log('Retirement calc listening on port 3000!')
})
