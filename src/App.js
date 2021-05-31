import React from 'react'
import './App.css'
import Amplify, {API, Storage} from 'aws-amplify'
import { AmplifyAuthenticator, AmplifySignUp, AmplifySignOut } from '@aws-amplify/ui-react'
import { AuthState, onAuthUIStateChange } from '@aws-amplify/ui-components'
import config from './aws-exports'
import Alert from '@material-ui/lab/Alert'

Amplify.configure(config);

const ImageComponent = props => {
    const image = props.image
    const imageStyle = {
        width: "256px",
        height: "256px",
    }

    const [tag, setTag] = React.useState('')
    const [showAlert, setShowAlert] = React.useState('')
    
    const handleTagChange = (event) => {
        setTag(event.target.value)
    } 

    const addTag = () => {
        const params = {'etag': image['eTag'],'tag': tag}
        API.put('fit5225', '/images', {queryStringParameters: params})
        .then(response => {
            setShowAlert('Add tag' + tag + 'successfully!')
        })
        .catch(error => {
            console.log(error);
        })
    }

    const deleteImageFromDB = () => {
        const params = {etag: image['eTag']}
        API.del('fit5225', '/images', {queryStringParameters: params})
        .then(response => {
            deleteImageFromS3()
        })
        .catch(error => {
            console.log(error);
        })
    }

    const deleteImageFromS3 = () => {
        const key = image['key']
        Storage.remove(key, {level:'private'})
            .then(() => {
                props.onDeleteImage()
            })
            .catch(error => console.log(error))
    }

    return (
        <span>
            <div>
                <tr>
                <th><img style={imageStyle} src={image['url']} /></th>
                <th>Add tag:</th>
                <th><input type="text" name="tag" value={tag} onChange={handleTagChange} /></th>
                <th><button onClick={() => addTag()}>Add</button></th>
                <th><button onClick={() => deleteImageFromDB()}>Delete</button></th>
                <div>{showAlert !== '' ? <Alert onClose={() => {
                    setShowAlert('')
                }}>{showAlert}</Alert> : null }</div>
                </tr>
            </div>
        </span>
    )
}

const AuthStateApp = () => {
    const [authState, setAuthState] = React.useState();
    const [user, setUser] = React.useState();

    React.useEffect(() => {
        return onAuthUIStateChange((nextAuthState, authData) => {
            setAuthState(nextAuthState);
            setUser(authData)
        });
    }, []);

    React.useEffect(() => {
        if (authState == AuthState.SignedIn) {
            loadImageETag()
        }
    }, [authState])

    const [albumProgress, setAlbumProgress] = React.useState('loading')
    const [tagStr, setTagStr] = React.useState('');
    const [eTags, setETags] = React.useState([]);
    const [images, setImages] = React.useState([]);

    const loadImageETag = async() => {
        setAlbumProgress('loading')
        const tags = tagStr.split(',')
        const tagsTmp = tags.map((each) => {
            return each.trim()
        })
        var params = {}
        tagsTmp.forEach(function(value, i) {
            params['tag' + i] = value
        });

        API.get('fit5225','/images', {queryStringParameters: params})
        .then(response => {
            setETags(response);
        })
        .catch(error => {
            console.log(error);
        })

    }

    React.useEffect(() => {
        if (authState === AuthState.SignedIn && user) {
            loadImage()
        }
    }, [eTags])

    const loadImage = () => {
        Storage.list('',{level:'private'})
            .then(async(result) => {
                var displayImages = []

                if (tagStr.length ==0 ){
                    for (const [index, image] of result.entries()){
                        const singedURL = await Storage.get(image['key'], {level: 'private'});
                        const tmpImage = image
                        tmpImage['url'] = singedURL
                        displayImages.push(tmpImage)
                    }
                    setImages(displayImages)
                    setAlbumProgress('loaded')
                }

                if (tagStr.split(',').length > 0) {
                    for (const [index, image] of result.entries()) {
                        if (!eTags.includes(image['eTag'])) {
                            continue
                        }
                        const singedURL = await Storage.get(image['key'], {level: 'private'});
                        const tmpImage = image
                        tmpImage['url'] = singedURL
                        displayImages.push(tmpImage)
                    }
                    if(displayImages.length == 0){
                        setAlbumProgress('noimage')
                    }
                    if (displayImages.length > 0)
                    {
                        setImages(displayImages)
                        setAlbumProgress('loaded')
                    }
                    
                }

                
            })
    }

    const albumContent = () => {
        switch (albumProgress) {
            case 'loading':
                return <h2>Loading Album</h2>
            case 'loaded':
                return images.map((each) => {
                    return(
                        <ImageComponent key = {each['url']} image = {each} onDeleteImage = {loadImageETag} />
                    )
                })
            case 'noimage':
                return <h2>No such image</h2>
            default:
                break;
        }
    }

    const searchTag = () => {
        return (
            <>
                <div>
                    Search image by tags
                </div>
                <div>
                    <input type = "text" value = {tagStr} onChange = {e => setTagStr(e.target.value)} />
                    <button onClick={loadImageETag}>Search</button>
                </div>
                <div id='notice'>Split tags by ","</div>
            </>
        )
    }

    const [uploadProgress, setUploadProgress] = React.useState('getUpload');
    const [uploadImage, setUploadImage] = React.useState();
    const [errorMessage, setErrorMessage] = React.useState();
    const upload = async () => {
      try {
          setUploadProgress('uploading')
          await Storage.put(`${user.username + Date.now()}.jpeg`, uploadImage, {
              level: 'private',
              contentType: 'image/jpeg'
          });
          setUploadProgress('uploaded')
      } catch (error) {
          console.log('error in upload', error);
          setErrorMessage(error.message)
          setUploadProgress('uploadError')
      }
    }

    const uploadContent = () => {
        switch (uploadProgress) {
            case 'getUpload':
                return (
                    <>
                        <div>Upload image</div>
                        <input type="file" accept="image/*" onChange={e => setUploadImage(e.target.files[0])}/>
                        <button onClick={upload}>Upload</button>
                    </>
                )
            case'uploading':
                return <h2>Uploading</h2>
            case'uploaded':
                return (
                    <>
                        <div>
                            Upload successful!
                        </div>
                        <input type="file" accept="image/*" onChange={e => setUploadImage(e.target.files[0])}/>
                        <button onClick={upload}>Upload</button>
                    </>
                )
            case 'uploadError':
                return (
                    <>
                        <div>
                            Error message = {errorMessage}
                        </div>
                        <input type="file" accept="image/*" onChange={e => setUploadImage(e.target.files[0])}/>
                        <button onClick={upload}>Upload</button>
                    </>
                )

            default:
                break;
        }
    }

    React.useEffect(() => {
        if (uploadProgress == 'uploaded') {
            loadImageETag()
        }
    } ,[uploadProgress])

    return authState === AuthState.SignedIn && user ? (
      <div>
        <header>
          <div >
          <tr align='right'>
              <th width="5%"></th>
              <th width="25%" align='center'>Hello, {user.username}</th>
              <th width="5%"><AmplifySignOut/></th>
          </tr>
          </div>
        </header>
        <body className='App-header'>
            <div>{uploadContent()}</div>
            <br/>
            <div>{searchTag()}</div>
            <br/>
            <div>{albumContent()}</div>
        </body>
      </div>
    ) : (
      <AmplifyAuthenticator>
        <AmplifySignUp
          slot="sign-up"
          formFields={[
            { type: "username" },
            { type: "password" },
            { type: "given_name",
              label: "Given Name *", 
              placeholder: "Enter your given name", 
              required: true,
            },
            { type: "family_name",
              label: "Family Name *", 
              placeholder: "Enter your family name", 
              required: true,
            }
          ]}
        />
      </AmplifyAuthenticator>
    );
}

export default AuthStateApp;