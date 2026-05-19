GET_PROJECT_META = """
query GetProjectMeta($owner: String!, $number: Int!) {
  organization(login: $owner) {
    projectV2(number: $number) {
      id
      title
      fields(first: 50) {
        nodes {
          ... on ProjectV2Field {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
          ... on ProjectV2IterationField {
            id
            name
          }
        }
      }
    }
  }
}
"""

LIST_ITEMS = """
query ListItems($projectId: ID!, $cursor: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            ... on Issue {
              id
              number
              title
              state
              url
              assignees(first: 5) {
                nodes { login }
              }
              labels(first: 10) {
                nodes { name }
              }
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field { ... on ProjectV2Field { name } }
              }
            }
          }
        }
      }
    }
  }
}
"""

UPDATE_FIELD = """
mutation UpdateField(
  $projectId: ID!
  $itemId: ID!
  $fieldId: ID!
  $value: ProjectV2FieldValue!
) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: $value
  }) {
    projectV2Item {
      id
    }
  }
}
"""

ADD_COMMENT = """
mutation AddComment($issueId: ID!, $body: String!) {
  addComment(input: {
    subjectId: $issueId
    body: $body
  }) {
    commentEdge {
      node {
        id
        url
      }
    }
  }
}
"""
