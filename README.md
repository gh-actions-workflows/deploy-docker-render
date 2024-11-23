# deploy-docker-render

The `gh-actions-workflows/deploy-docker-render` action is a JavaScript action that deploys a Docker image to an existing service on [Render](https://render.com) platform. This action can be run on `ubuntu-latest`, `windows-latest`, and `macos-latest` GitHub Actions runners.

# Usage

Triggering the deploy hook:
```yaml
steps:
  - name: Deploy to Render
    uses: gh-actions-workflows/deploy-docker-render@v1.1
    with:
      deploy-hook: ${{ secrets.RENDER_DEPLOY_HOOK }}
      image-url: my-dockerhub-user/my-app:my-tag
```

Triggering the deploy hook and waiting for the deploy to go live:
```yaml
steps:
  - name: Deploy to Render
    uses: gh-actions-workflows/deploy-docker-render@v1.1
    with:
      deploy-hook: ${{ secrets.RENDER_DEPLOY_HOOK }}
      image-url: my-dockerhub-user/my-app:my-tag
      render-api-key: ${{ secrets.RENDER_API_KEY }}
      wait-for-deployment: true
```

Below is a complete usage example:
```yaml
name: My Workflow
on: [push]

jobs:
  lint:
    uses: gh-actions-workflows/python-workflows/.github/workflows/flake8.yaml@master

  test:
    needs: lint
    uses: gh-actions-workflows/python-workflows/.github/workflows/pytest.yaml@master

  publish:
    uses: gh-actions-workflows/docker-workflows/.github/workflows/docker-publish.yaml@master
    if: ${{ github.ref_name == 'master' || github.ref_name == 'develop'}}
    needs: test
    with:
      app_name: 'my-app'
      docker_hub_user: ${{ vars.DOCKER_HUB_USER }}
    secrets:
      docker_hub_password: ${{ secrets.DOCKER_HUB_PASSWORD }}

  deploy:
    if: ${{ github.ref_name == 'master' }}
    needs: publish
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Render
        uses: gh-actions-workflows/deploy-docker-render@v1.1
        with:
          deploy-hook: ${{ secrets.RENDER_DEPLOY_HOOK }}
          image-url: ${{ needs.publish.outputs.image_name }}
          render-api-key: ${{ secrets.RENDER_API_KEY }}
          wait-for-deployment: true
```

For more information about the other parameters, see [action.yml](https://github.com/gh-actions-workflows/deploy-docker-render/blob/master/action.yml).
