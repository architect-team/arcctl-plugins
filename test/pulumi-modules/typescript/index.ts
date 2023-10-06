import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

let config = new pulumi.Config();

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("my-bucket", {
  website: {
      indexDocument: "index.html",
  },
});

const ownershipControls = new aws.s3.BucketOwnershipControls("ownership-controls", {
  bucket: bucket.id,
  rule: {
      objectOwnership: "ObjectWriter"
  }
});

const publicAccessBlock = new aws.s3.BucketPublicAccessBlock("public-access-block", {
  bucket: bucket.id,
  blockPublicAcls: false,
});

// Create an S3 Bucket object
const bucketObject = new aws.s3.BucketObject("index.html", {
  bucket: bucket.id,
  source: new pulumi.asset.StringAsset(`
<html>
  <body>
      <h1>Hello, ${config.get('world_text') || 'Architect'}!</h1>
  </body>
</html>`),
  contentType: "text/html",
  acl: "public-read",
}, { dependsOn: publicAccessBlock });

// Export the name of the bucket
export const bucketName = bucket.id;
export const bucketEndpoint = pulumi.interpolate`http://${bucket.websiteEndpoint}`;
