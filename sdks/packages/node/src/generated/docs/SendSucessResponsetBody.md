
# SendSucessResponsetBody


## Properties

Name | Type
------------ | -------------
`message` | string
`mid` | number

## Example

```typescript
import type { SendSucessResponsetBody } from '@turbosmtp/sdk'

// TODO: Update the object below with actual values
const example = {
  "message": OK,
  "mid": 1688566310828572700,
} satisfies SendSucessResponsetBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SendSucessResponsetBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


