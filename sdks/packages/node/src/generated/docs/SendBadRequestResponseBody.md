
# SendBadRequestResponseBody


## Properties

Name | Type
------------ | -------------
`message` | string
`errors` | Array&lt;string&gt;

## Example

```typescript
import type { SendBadRequestResponseBody } from '@turbosmtp/sdk'

// TODO: Update the object below with actual values
const example = {
  "message": error,
  "errors": [missing or not valid sender email (from)],
} satisfies SendBadRequestResponseBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SendBadRequestResponseBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


