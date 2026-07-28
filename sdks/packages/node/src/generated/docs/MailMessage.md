
# MailMessage


## Properties

Name | Type
------------ | -------------
`from` | string
`to` | string
`subject` | string
`cc` | string
`bcc` | string
`content` | string
`htmlContent` | string
`customHeaders` | { [key: string]: string; }
`referenceId` | string
`xCampaignID` | string
`mimeRaw` | string
`attachments` | [Array&lt;Attachment&gt;](Attachment.md)

## Example

```typescript
import type { MailMessage } from '@turbosmtp/sdk'

// TODO: Update the object below with actual values
const example = {
  "from": null,
  "to": null,
  "subject": null,
  "cc": null,
  "bcc": null,
  "content": null,
  "htmlContent": null,
  "customHeaders": null,
  "referenceId": null,
  "xCampaignID": null,
  "mimeRaw": null,
  "attachments": null,
} satisfies MailMessage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MailMessage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


