# twitter-media-exporter
 
A utility for performing a batch download of tweet content and their attached images. This application will access the favorites / likes of the logged in user for download.

## Usage
To use this, create your own Twitter Developer account and project application in the **Developer Portal**.

If you are using **VS Code Remote - Containers** extension, set the appropriate environment variables using the API key and API key secret in `.devcontainer/devcontainer.env` (this is ignored by the repository to prevent accidental commits).

Set an arbitrary string value for caching the user's OAuth token inside the container environment.

An example of a `devcontainer.env` file with unset environment variables is included `.devcontainer/example-devcontainer.env`.

### Environment Variables (.devcontainer/devcontainer.env)
```
CONSUMER_KEY=<Twitter App API Key>
CONSUMER_SECRET=<Twitter App API Key Secret>
OAUTH_KEY=<An arbitrary string to use as an encryption key>
```

Build and run the application:

```
npm run build   # Build the application
node out --help # Check the application default parameters
node out        # Run the application with default parameters
```

## Links (fresh as of 2021-01-10)

- [VS Code Remote - Containers Extension Documentation](https://code.visualstudio.com/docs/remote/containers)
- [Twitter Developer Platform - Getting Started](https://developer.twitter.com/en/docs/getting-started)
- [Twitter API Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal/projects-and-apps)