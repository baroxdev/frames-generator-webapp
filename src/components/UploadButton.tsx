import { LoadingOutlined, PictureFilled } from '@ant-design/icons';

import { config } from '../config';

const UploadButton = ({ loading }: { loading: boolean }) => {
  return (
    <div>
      {loading ? (
        <LoadingOutlined />
      ) : (
        <div className='text-3xl text-gray-300'>
          {' '}
          <PictureFilled />
        </div>
      )}
      <div className='mt-2 max-md:mt-1 text-gray-400 max-md:text-xs'>
        {config.text.your_picture}
      </div>
    </div>
  );
};

export default UploadButton;
