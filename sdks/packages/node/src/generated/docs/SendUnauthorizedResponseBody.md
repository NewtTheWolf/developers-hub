
# SendUnauthorizedResponseBody


## Properties

Name | Type
------------ | -------------
`errorCode` | number
`message` | string
`details` | string

## Example

```typescript
import type { SendUnauthorizedResponseBody } from '@turbosmtp/sdk'

// TODO: Update the object below with actual values
const example = {
  "errorCode": 3,
  "message": Invalid authorization token,
  "details": No authorization key was specified for request: POST /api/mail/send,
} satisfies SendUnauthorizedResponseBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SendUnauthorizedResponseBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


