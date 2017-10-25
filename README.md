# Retirement Calc API

Requires Node with npm or Yarn.

## Build and Run
```sh
$ yarn
$ node index.js
```

## Working API
A working version of this API can be found at:

https://wt-f2d928a96e64c8796d70d3055c64414c-0.run.webtask.io/retirement-calc

The root GET will provide a swagger doc to show you how to use it (could use something like http://editor2.swagger.io > "File" > "Import URL" and paste the above URL to view the HTML friendly version).

A POST to `/calc` with the params object filled out should provide some retirement savings estimates based on input.

An example POST to https://wt-f2d928a96e64c8796d70d3055c64414c-0.run.webtask.io/retirement-calc/calc might look like this:
```
{
  "monthlyCosts": "3500",
  "yearsInRetirement": "35",
  "yearsUntilRetirment": "35",
  "inflation": "3",
  "preRateOfReturn": "6",
  "postRateOfReturn": "3",
  "taxRate": "30",
  "currentTaxDeferredCapital": "90000",
  "monthlyIncome": "1800"
}
```